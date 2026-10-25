export default function manifest() {
  return {
    name: 'مُضيف: إدارة الحجوزات',
    short_name: 'مُضيف',
    description: 'إدارة حجوزات الغرف والاستوديوهات من كل المنصات',
    start_url: '/dashboard',
    display: 'standalone',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#F4F6F5',
    theme_color: '#174634',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
