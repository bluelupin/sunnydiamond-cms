export const normalizeBlogTag = (value: string) => {
  const label = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return { label, key: label.toLowerCase() };
};

export const relatedBlogFilters = (documentId: string, tagIds: string[]) => ({
  documentId: { $ne: documentId },
  blogTags: { documentId: { $in: tagIds } },
});
