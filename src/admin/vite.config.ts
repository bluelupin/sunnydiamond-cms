import { mergeConfig, type Plugin, type UserConfig } from 'vite';
import { readFile } from 'node:fs/promises';

/** Keep Strapi's relation fetching/saving, changing only the blog tag picker. */
export function transformBlogPostAdmin(source: string, id: string) {
    const path = id.split('?')[0].replace(/\\/g, '/');
    if (path.endsWith('/content-manager/dist/admin/pages/EditView/components/FormInputs/Relations/RelationModal.mjs')) {
      const before = 'const documentTitle = currentDocument.getTitle(documentLayoutResponse.edit.settings.mainField);';
      if (source.split(before).length !== 2) {
        throw new Error('Strapi relation modal changed. Update the blog tag heading customization.');
      }
      return {
        code: source.replace(before, `const documentTitle = currentDocumentMeta.model === 'api::blog-tag.blog-tag'
          ? (isCreating ? 'New Blog Tag' : currentDocument.document?.label || 'Blog Tag')
          : currentDocument.getTitle(documentLayoutResponse.edit.settings.mainField);`),
        map: null,
      };
    }
    if (path.endsWith('/content-manager/dist/admin/pages/ListView/ListViewPage.mjs')) {
      // Strapi also stores each editor's chosen columns in local storage.
      const before = 'displayedHeaderNames.filter((header)=>Object.keys(schema?.attributes).includes(header))';
      if (source.split(before).length !== 2) {
        throw new Error('Strapi list view changed. Update the blog tag column customization.');
      }
      return {
        code: source.replace(before, `displayedHeaderNames.filter((header)=>
          Object.keys(schema?.attributes).includes(header) &&
          (model !== 'api::blog-post.blog-post' || !['blogTags', 'tags'].includes(header))
        )`),
        map: null,
      };
    }
    if (!path.endsWith('/content-manager/dist/admin/pages/EditView/components/FormInputs/Relations/Relations.mjs')) {
      return null;
    }

    const replacements = [
      [
        "const [textValue, setTextValue] = React.useState('');",
        `const [textValue, setTextValue] = React.useState('');
    const isBlogTagPicker = relation.model === 'api::blog-tag.blog-tag' && name === 'blogTags';
    const [pickerOpen, setPickerOpen] = React.useState(false);
    const keepOpenAfterSelection = React.useRef(false);
    const creatingTag = React.useRef(false);`,
      ],
      [
        'onCreateOption: ()=>{',
        `onCreateOption: ()=>{
                    if (isBlogTagPicker) {
                        // CreateItem also emits the search text as a selected value
                        // after this callback. It is not an existing relation ID.
                        creatingTag.current = true;
                        queueMicrotask(()=>{ creatingTag.current = false; });
                        keepOpenAfterSelection.current = false;
                        setPickerOpen(false);
                    }`,
      ],
      [
        'onOpenChange: ()=>{\n                    handleSearch(textValue ?? \'\');\n                },',
        `open: isBlogTagPicker ? pickerOpen : undefined,
                // A controlled value makes selection notify synchronously, before
                // the primitive requests closure. Uncontrolled values notify in an effect.
                value: isBlogTagPicker ? '' : undefined,
                onOpenChange: (open)=>{
                    if (isBlogTagPicker) {
                        if (!open && keepOpenAfterSelection.current) {
                            keepOpenAfterSelection.current = false;
                            return;
                        }
                        setPickerOpen(open);
                    }
                    handleSearch(textValue ?? '');
                },`,
      ],
      [
        'onChange: handleChange,',
        `onChange: (value)=>{
                    if (isBlogTagPicker && (creatingTag.current || !options.some((option)=>option.id.toString() === value))) {
                        return;
                    }
                    if (isBlogTagPicker && value) {
                        keepOpenAfterSelection.current = true;
                        // The combobox requests closure synchronously after selection.
                        queueMicrotask(()=>{ keepOpenAfterSelection.current = false; });
                        handleSearch('');
                    }
                    handleChange(value);
                },`,
      ],
      [
        'const options = data?.results ?? [];\n    React.useLayoutEffect',
        `const options = (data?.results ?? []).filter((option)=>
        !isBlogTagPicker || !fieldValue?.connect?.some((selected)=>selected.id === option.id)
    );
    React.useLayoutEffect`,
      ],
    ];

    for (const [before, after] of replacements) {
      if (source.split(before).length !== 2) {
        throw new Error('Strapi relation picker changed. Update the blog-tag-multiselect Vite customization.');
      }
      source = source.replace(before, after);
    }

    return { code: source, map: null };
}

const blogTagMultiselect = (): Plugin => ({
  name: 'blog-tag-multiselect',
  enforce: 'pre',
  transform: transformBlogPostAdmin,
});

export default (config: UserConfig) => mergeConfig(config, {
  // Keep Strapi in the normal dependency bundle so shared React contexts and
  // CommonJS dependencies work. Apply the same customization during prebundling.
  optimizeDeps: {
    esbuildOptions: {
      plugins: [{
        name: 'blog-post-admin-prebundle',
        setup(build) {
          build.onLoad({ filter: /[\\/]content-manager[\\/]dist[\\/]admin[\\/].*[\\/](Relations|RelationModal|ListViewPage)\.mjs$/ }, async ({ path }) => {
            const result = transformBlogPostAdmin(await readFile(path, 'utf8'), path);
            return result ? { contents: result.code, loader: 'js' } : undefined;
          });
        },
      }],
    },
  },
  plugins: [blogTagMultiselect()],
});
