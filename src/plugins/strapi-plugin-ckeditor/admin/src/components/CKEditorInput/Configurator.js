import { StrapiMediaLib } from "./plugins/StrapiMediaLib";
import { StrapiEditorUsageDataPlugin } from "./plugins/StrapiEditorUsageData";

import MaximumLength from "../../vendor/ckeditor5-maximum-length/index";
import "../../vendor/ckeditor5-maximum-length/index-editor.css";

const {
  Alignment,
  Autoformat,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Subscript,
  Superscript,
  BlockQuote,
  CodeBlock,
  Essentials,
  FontSize,
  FontFamily,
  FontColor,
  FontBackgroundColor,
  GeneralHtmlSupport,
  Heading,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Indent,
  IndentBlock,
  Link,
  LinkImage,
  List,
  TodoList,
  Markdown,
  MediaEmbed,
  Paragraph,
  Table,
  TableToolbar,
  TableProperties,
  TableCaption,
  Highlight
} = window.CKEDITOR;

const CKEDITOR_BASE_CONFIG_FOR_PRESETS = {
  light: {
    plugins: [
      Autoformat,
      Bold,
      Italic,
      Essentials,
      GeneralHtmlSupport,
      Heading,
      Image,
      ImageCaption,
      ImageStyle,
      ImageToolbar,
      ImageUpload,
      Indent,
      Link,
      List,
      Paragraph,
      Table,
      TableToolbar,
      TableCaption,
      StrapiMediaLib,
      StrapiEditorUsageDataPlugin
    ],
    toolbar: [
      'undo', 'redo',
      '|',
      'heading',
      '|',
      'bold', 'italic',
      '|',
      'link', 'strapiMediaLib', 'insertTable',
      '|',
      'bulletedList', 'numberedList'
    ],
    heading: {
      options: [
        { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
        { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
        { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
      ]
    },
    image: {
      toolbar: [
        'imageStyle:inline',
        'imageStyle:block',
        'imageStyle:side',
        '|',
        'toggleImageCaption',
        'imageTextAlternative'
      ]
    },
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells',
        '|',
        'toggleTableCaption'
      ]
    },
    link: {
      decorators: {
        openInNewTab: {
          mode: 'manual',
          label: 'Open in a new tab',
          attributes: {
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        }
      }
    }
  },

  standard: {
    plugins: [
      Autoformat,
      Bold,
      Italic,
      BlockQuote,
      CodeBlock,
      Essentials,
      GeneralHtmlSupport,
      Heading,
      Image,
      ImageCaption,
      ImageStyle,
      ImageToolbar,
      ImageUpload,
      Indent,
      Link,
      LinkImage,
      List,
      MediaEmbed,
      Paragraph,
      Table,
      TableToolbar,
      TableCaption,
      StrapiMediaLib,
      StrapiEditorUsageDataPlugin
    ],
    toolbar: [
        'undo', 'redo',
        '|',
        'heading',
        '|',
        'bold', 'italic',
        '|',
        'link', 'strapiMediaLib', 'mediaEmbed', 'blockQuote', 'insertTable', 'codeBlock',
        '|',
        'bulletedList', 'numberedList', 'outdent', 'indent'
    ],
    heading: {
      options: [
        { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
        { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
        { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
      ]
    },
    image: {
      toolbar: [
        'imageStyle:inline',
        'imageStyle:block',
        'imageStyle:side',
        '|',
        'toggleImageCaption',
        'imageTextAlternative',
        '|',
        'linkImage'
      ]
    },
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells',
        '|',
        'toggleTableCaption'
      ]
    },
    link: {
      decorators: {
        openInNewTab: {
          mode: 'manual',
          label: 'Open in a new tab',
          attributes: {
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        }
      }
    }
  },

  rich: {
    plugins: [
      Alignment,
      Autoformat,
      Bold,
      Italic,
      Underline,
      Strikethrough,
      Code,
      Subscript,
      Superscript,
      BlockQuote,
      CodeBlock,
      Essentials,
      FontSize,
      FontFamily,
      FontColor,
      FontBackgroundColor,
      GeneralHtmlSupport,
      Heading,
      HorizontalLine,
      Image,
      ImageCaption,
      ImageStyle,
      ImageToolbar,
      ImageUpload,
      Indent,
      IndentBlock,
      Link,
      LinkImage,
      List,
      TodoList,
      MediaEmbed,
      Paragraph,
      Table,
      TableToolbar,
      TableProperties,
      TableCaption,
      Highlight,
      StrapiMediaLib,
      StrapiEditorUsageDataPlugin
    ],
    toolbar: {
      items: [
        'undo', 'redo',
        '|',
        'selectAll',
        '|',
        'heading',
        '|',
        'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor',
        '|',
        'bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript', 'code',
        '-',
        'link', 'strapiMediaLib', 'mediaEmbed', 'insertTable', 'horizontalLine', 'blockQuote', 'codeBlock', 'highlight',
        '|',
        'alignment',
        '|',
        'bulletedList', 'numberedList', 'todoList', 'outdent', 'indent',
      ],
      shouldNotGroupWhenFull: true
    },
    heading: {
      options: [
        { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
        { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
        { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
      ]
    },
    image: {
      toolbar: [
        'imageStyle:inline', 'imageStyle:block', 'imageStyle:side',
        '|',
        'toggleImageCaption', 'imageTextAlternative',
        '|',
        'linkImage'
      ]
    },
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells',
        '|',
        'tableProperties',
        '|',
        'toggleTableCaption'
      ]
    },
    fontSize: {
      options: [
          9,
          11,
          13,
          'default',
          17,
          19,
          21,
          27,
          35,
      ],
      supportAllValues: false
    },
    fontFamily: {
      options: [
        'default',
        'Arial, Helvetica Neue, Helvetica, Source Sans Pro, sans-serif',
        'Courier New, Courier, monospace',
        'Georgia, serif',
        'Lucida Sans Unicode, Lucida Grande, sans-serif',
        'Tahoma, Geneva, sans-serif',
        'Times New Roman, Times, serif',
        'Trebuchet MS, Helvetica, sans-serif',
        'Verdana, Geneva, sans-serif',
        'Roboto, Roboto Black, Roboto Medium, Roboto Light, sans-serif',
      ],
      supportAllValues: true
    },
    fontColor: {
      columns: 5,
      documentColors: 10,
    },
    fontBackgroundColor: {
      columns: 5,
      documentColors: 10,
    },
    link: {
      decorators: {
        openInNewTab: {
          mode: 'manual',
          label: 'Open in a new tab',
          attributes: {
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        }
      }
    }
  }
};

export default class Configurator {
  constructor ( fieldConfig ) {
    this.fieldConfig = fieldConfig;
  }

  getEditorConfig() {
    const config = this._getBaseConfig();

    const maxLength = this.fieldConfig.maxLength;
    const outputOption = this.fieldConfig.options.output;
    const licenseKey = this.fieldConfig.licenseKey;

    config.licenseKey = licenseKey;
    config.htmlSupport = {
      allow: [
        {
          name: 'video',
          attributes: {
            src: true,
            controls: true,
            preload: true,
            playsinline: true,
            poster: true,
            width: true,
            height: true
          }
        },
        {
          name: 'source',
          attributes: {
            src: true,
            type: true
          }
        }
      ]
    };

    if ( config.plugins.includes( MediaEmbed ) ) {
      config.mediaEmbed = {
        previewsInData: true,
        extraProviders: [
          {
            name: 'directVideo',
            url: /^(https?:\/\/[^\s"'<>]+\.(?:mp4|webm)(?:[?#][^\s"'<>]*)?)$/i,
            html: match =>
              `<video src="${ match[ 0 ] }" controls preload="metadata" playsinline></video>`
          }
        ]
      };
    }

    if ( outputOption === 'Markdown' ) {
      config.plugins.push( Markdown );
    }

    if ( maxLength ) {
      config.plugins.push( MaximumLength );

      config.maximumLength = {
        characters: maxLength
      };
    }

    return config;
  }

  _getBaseConfig() {
    const presetName = this.fieldConfig.options.preset;

    switch ( presetName ) {
      case 'light':
        return CKEDITOR_BASE_CONFIG_FOR_PRESETS.light;
      case 'standard':
        return CKEDITOR_BASE_CONFIG_FOR_PRESETS.standard;
      case 'rich':
        return CKEDITOR_BASE_CONFIG_FOR_PRESETS.rich;
      default:
        throw new Error('Invalid preset name ' + presetName);
    }
  }
}
