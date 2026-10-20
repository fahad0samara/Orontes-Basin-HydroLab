import type {Metadata} from 'next';
import {Plus_Jakarta_Sans, IBM_Plex_Mono, IBM_Plex_Sans_Arabic} from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'مختبر هيدرولوجيا حوض نهر العاصي وسهل الغاب | Orontes Basin HydroLab',
  description:
    'المنظومة الهيدرولوجية المتكاملة لنمذجة تراكم الجريان السطحي (D8)، مؤشر الرطوبة الطبوغرافية (TWI)، القابلية للفيضان (FSI)، وجودة المياه الزراعية في سهل الغاب وحوض نهر العاصي.',
  openGraph: {
    title: 'مختبر هيدرولوجيا حوض نهر العاصي وسهل الغاب | Orontes Basin HydroLab',
    description:
      'المنظومة الهيدرولوجية المتكاملة لنمذجة تراكم الجريان السطحي (D8)، مؤشر الرطوبة الطبوغرافية (TWI)، القابلية للفيضان (FSI)، وجودة المياه الزراعية في سهل الغاب وحوض نهر العاصي.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'مختبر هيدرولوجيا حوض نهر العاصي وسهل الغاب | Orontes Basin HydroLab',
    description:
      'المنظومة الهيدرولوجية المتكاملة لنمذجة تراكم الجريان السطحي (D8)، مؤشر الرطوبة الطبوغرافية (TWI)، القابلية للفيضان (FSI)، وجودة المياه الزراعية في سهل الغاب وحوض نهر العاصي.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${ibmPlexArabic.variable} ${plusJakarta.variable} ${ibmPlexMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#070A10] text-slate-100 antialiased font-sans selection:bg-sky-600 selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
