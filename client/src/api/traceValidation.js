export function traceValidation(fields, categories, { requireDetails = true, requirePhoto = true, hasPhoto = false } = {}) {
  const errors = {};
  if (!categories.some((category) => category.id === fields.category_id)) errors.category_id = "Choose an active category.";
  if (requireDetails) {
    if (!fields.title?.trim()) errors.title = "Enter a title.";
    if (!fields.description?.trim()) errors.description = "Describe what you observed.";
    if (!fields.location_name?.trim()) errors.location_name = "Enter the location.";
  }
  if (requirePhoto && !hasPhoto) errors.photo = "Add at least one photo before submitting.";
  return errors;
}

export const hasAttachedPhoto = (trace) => (trace.trace_media || []).some((media) => media.id && media.mime_type?.startsWith("image/"));
