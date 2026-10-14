export function getQRCodeUrl(url: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
}

export function getFallbackQRCodeUrl(url: string, size = 300): string {
  return `https://quickchart.io/qr?size=${size}&text=${encodeURIComponent(url)}`;
}
