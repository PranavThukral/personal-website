import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { site } from "./content";
import "./globals.css";

// The interface uses the system's own UI font (Segoe UI on Windows, as in Office); only formulas use a web font.
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono" });

const title = "Pranav Thukral, Waterloo CS/BBA";

// Runs before first paint so a dark-mode visitor never sees a white flash. A saved choice wins over the system.
// It also marks repeat visits in the same tab session, which skip the loading screen.
const themeScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.dataset.theme=t}catch(e){}try{if(sessionStorage.getItem("booted"))d.dataset.boot="skip";else sessionStorage.setItem("booted","1")}catch(e){}})()`;

// A brief loading screen: about a second and a half, once per visit. Pure CSS, so it shows at first paint and
// clears itself even before the app's script runs. Its hidden base style also keeps it out of the way
// when a browser disables animations.
const BOOT_PHRASES = ["Loading cells…", "Determining interests…", "Calculating ambition…"];

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  alternates: { canonical: "/" },
  title,
  description: site.description,
  authors: [{ name: site.name }],
  creator: site.name,
  openGraph: {
    type: "profile",
    url: "/",
    title,
    description: site.description,
    firstName: "Pranav",
    lastName: "Thukral",
  },
  twitter: { card: "summary_large_image", title, description: site.description },
};

export const viewport: Viewport = {
  themeColor: "#141519",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA" className={mono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="boot" aria-hidden="true" inert>
          <div className="boot-inner">
            <p className="boot-name">{site.name}</p>
            <div className="boot-track">
              <span className="boot-fill" />
            </div>
            <p className="boot-phrases">
              {BOOT_PHRASES.map((phrase) => (
                <span key={phrase}>{phrase}</span>
              ))}
            </p>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
