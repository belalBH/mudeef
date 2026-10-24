import './globals.css';

export const metadata = {
  title: 'مُضيف | إدارة الحجوزات',
  description: 'إدارة حجوزات الغرف والاستوديوهات من Airbnb وBooking.com وجاذر إن في مكان واحد',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#1F5C45' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
