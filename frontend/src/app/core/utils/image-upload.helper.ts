const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif'
};

/** Normalize mobile gallery picks that often lack a reliable MIME type. */
export function prepareImageUpload(file: File): File {
  const name = file.name?.trim() || 'photo.jpg';
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? 'jpg' : 'jpg';
  const mime = file.type && file.type !== 'application/octet-stream'
    ? file.type
    : (EXT_TO_MIME[ext] ?? 'image/jpeg');
  if (file.type === mime && file.name) {
    return file;
  }
  return new File([file], name.includes('.') ? name : `${name}.${ext}`, { type: mime, lastModified: file.lastModified });
}
