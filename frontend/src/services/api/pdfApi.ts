import axiosClient from './axiosClient';

function resolveFilename(contentDisposition?: string, fallbackName = 'report.pdf') {
  if (!contentDisposition) return fallbackName;
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(contentDisposition);
  const raw = match?.[1] || match?.[2];
  if (!raw) return fallbackName;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function downloadPdf(
  endpoint: string,
  options?: {
    params?: Record<string, string | number | boolean | undefined>;
    fallbackFilename?: string;
  },
) {
  const response = await axiosClient.get<BlobPart>(endpoint, {
    params: options?.params,
    responseType: 'blob',
  });
  const filename = resolveFilename(
    response.headers?.['content-disposition'],
    options?.fallbackFilename || 'report.pdf',
  );

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
