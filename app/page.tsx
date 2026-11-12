import { site } from "./content";
import { Spreadsheet } from "./spreadsheet";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: site.url,
  description: site.description,
  email: `mailto:${site.email}`,
  sameAs: [site.linkedin, site.github],
  affiliation: [{ "@type": "CollegeOrUniversity", name: "University of Waterloo" }],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main>
        <Spreadsheet />
      </main>
    </>
  );
}
