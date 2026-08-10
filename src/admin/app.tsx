import type { StrapiApp } from '@strapi/strapi/admin';
import {
  unstable_useDocumentActions,
  useDocumentRBAC,
  type ContentManagerPlugin,
  type DocumentActionComponent,
  type DocumentActionProps,
} from '@strapi/content-manager/strapi-admin';
import { CheckCircle, Star } from '@strapi/icons';

const BLOG_POST_UID = 'api::blog-post.blog-post';

const ToggleFeaturedAction: DocumentActionComponent = ({
  collectionType,
  document,
  documentId,
  model,
}: DocumentActionProps) => {
  const { canPublish, canUpdate, canUpdateFields } = useDocumentRBAC(
    'ToggleFeaturedAction',
    ({ canPublish, canUpdate, canUpdateFields }) => ({
      canPublish,
      canUpdate,
      canUpdateFields,
    })
  );
  const { getDocument, isLoading, publish, update } =
    unstable_useDocumentActions();

  if (model !== BLOG_POST_UID || !documentId) return null;

  const isFeatured = document?.isFeatured === true;
  const canUpdateFeatured = Boolean(
    canUpdate && canUpdateFields.includes('isFeatured')
  );

  return {
    label: isFeatured ? 'Remove from featured' : 'Mark as featured',
    icon: isFeatured ? <Star fill='yellow' /> : <Star />,
    position: 'table-row',
    disabled: !canUpdateFeatured,
    loading: isLoading,
    onClick: async () => {
      const params = document?.locale ? { locale: document.locale } : undefined;
      const current = await getDocument({
        collectionType,
        model,
        documentId,
        params,
      });

      if (!current?.data) return;

      const nextIsFeatured = current.data.isFeatured !== true;
      const actionArgs = { collectionType, model, documentId, params };

      if (document?.status === 'published' && canPublish) {
        await publish(actionArgs, { isFeatured: nextIsFeatured });
        return;
      }

      await update(actionArgs, { isFeatured: nextIsFeatured });
    },
  };
};

ToggleFeaturedAction.position = 'table-row' as const;

export default {
  config: {},
  bootstrap(app: StrapiApp) {
    const contentManagerApis = app.getPlugin('content-manager')
      .apis as ContentManagerPlugin['config']['apis'];

    contentManagerApis.addDocumentAction([ToggleFeaturedAction]);
  },
};
