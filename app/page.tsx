"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";

type TimelineItem = {
  date: string;
  title: string;
  icon: string;
  iconTone: "medical" | "award" | "business" | "growth" | "network" | "school" | "bank";
  logoFile?: string;
  description: string;
  metrics?: string[];
};

type Skill = {
  name: string;
  className: string;
  slot: string;
  accent: string;
  logos: string[];
  description: string;
};

type WorkItem = {
  index: string;
  title: string;
  meta: string;
  description: string;
  tags: string[];
  imageLabel: string;
  imageSrc: string;
  projectUrl?: string;
  stack: string[];
  builtFor: string;
  role: string;
  outcome: string;
};

const identities = [
  "Builder.",
  "Explorer.",
  "Software Engineer.",
  "Business Analyst.",
  "Growth Marketer.",
  "Guitarist.",
  "Badminton Player.",
];

const photos = [
  "/photos/toronto_profile_photo.png",
  "/photos/conference_speaking.png",
  "/photos/event_photo.png",
];

const timeline: TimelineItem[] = [
  {
    date: "September 2022 - June 2024",
    title: "Medical Ambitions",
    icon: "MED",
    iconTone: "medical",
    description:
      "I entered high school aiming for medicine. In Grades 9 and 10, I joined medical clubs, volunteered at the local hospital, and built my academic life around one target: McMaster Health Sciences.",
  },
  {
    date: "June 2024",
    title: "Medical Terminology Experience",
    icon: "HOSA",
    iconTone: "medical",
    logoFile: "hosa_logo.jpg",
    description:
      "HOSA gave me my first serious test in medical terminology. I placed 10th nationally, but also realized the part I loved most was not memorization: it was pressure, communication, and problem-solving.",
  },
  {
    date: "September 2024",
    title: "Ambition Shift",
    icon: "BD",
    iconTone: "business",
    description:
      "I started to recognize that the work I enjoyed most lived closer to business: communication, strategy, and active problem-solving. My target programs shifted toward Queen's Commerce and Western Ivey.",
  },
  {
    date: "September 2024 - June 2025",
    title: "Leadership & Skill Development",
    icon: "UP",
    iconTone: "growth",
    logoFile: "ja_canada.jpg",
    description:
      "I became focused on building leadership ability through real operating experience: JA Company Program, SDG Change Challenge, and Sanskar. Across these roles, I worked on finance, event design, mentorship, and execution.",
    metrics: ["160% ROI", "$13K fund", "650+ students"],
  },
  {
    date: "May 2025",
    title: "National Champion",
    icon: "1ST",
    iconTone: "award",
    logoFile: "hosa_logo.jpg",
    description:
      "After placing 10th, I returned to HOSA Medical Terminology aiming for first. I built a disciplined study system with 3,000+ flashcards and placed 1st nationally out of 840 contestants.",
  },
  {
    date: "June 2025 - March 2026",
    title: "Business Development Internship",
    icon: "FOES",
    iconTone: "business",
    logoFile: "foes_image.jpg",
    description:
      "I joined FOES in my first formal business role. After a private equity research sprint, I moved into business development and gained hands-on exposure to CRM software, HubSpot, Apollo, sales prospecting, and partner-facing analysis.",
  },
  {
    date: "August 2025",
    title: "Founded The Pitch Deck",
    icon: "TPD",
    iconTone: "growth",
    logoFile: "pitch_deck_logo.png",
    description:
      "I started The Pitch Deck to solve a problem I had felt directly: talented students often miss high-impact opportunities because access depends on geography, networks, or luck.",
  },
  {
    date: "September 2025 - June 2026",
    title: "Larger Leadership Roles",
    icon: "NET",
    iconTone: "growth",
    logoFile: "td_logo.png",
    description:
      "I expanded into broader national and selective leadership spaces through JEC Canada, TD Talent Lab, and the ICON Talent Partners Fellowship, sharpening my work across economics, mentorship, and strategy.",
  },
  {
    date: "May 2026",
    title: "Waterloo CS/BBA Commitment",
    icon: "DD",
    iconTone: "school",
    logoFile: "waterloo_logo.png",
    description:
      "I committed to the Waterloo Computer Science and Laurier Business Administration Double Degree after realizing technical skill was not separate from business impact. CS/BBA gave me the clearest path to build both.",
  },
  {
    date: "June 2026 - August 2026",
    title: "RBC Innovation Developer",
    icon: "RBC",
    iconTone: "bank",
    logoFile: "rbc.svg",
    description:
      "I will join RBC as an Innovation Developer Intern, working on software, internal process improvement, and technical solutions inside a large financial institution.",
  },
];

const skills: Skill[] = [
  {
    name: "Python",
    className: "skill-python",
    slot: "slot-python",
    accent: "#3776ab",
    logos: ["python.svg"],
    description:
      "I use Python to turn messy problems into structured systems: cleaning data, automating repetitive workflows, building backend logic, and exploring technical or business questions with a practical analytical toolkit.",
  },
  {
    name: "NextJS & TypeScript",
    className: "skill-next",
    slot: "slot-next",
    accent: "#3178c6",
    logos: ["nextjs.svg", "typescript.svg"],
    description:
      "I build typed, production-ready web experiences with NextJS and TypeScript, focusing on reusable components, predictable routing, clean data flow, responsive interfaces, and frontend architecture that can grow past a prototype.",
  },
  {
    name: "PowerPoint",
    className: "skill-powerpoint",
    slot: "slot-powerpoint",
    accent: "#d35230",
    logos: ["powerpoint.png"],
    description:
      "I use PowerPoint as a strategy communication tool: building pitch decks, executive-facing presentations, case competition materials, sponsor decks, and visual narratives that help people understand decisions quickly.",
  },
  {
    name: "Excel",
    className: "skill-excel",
    slot: "slot-excel",
    accent: "#21a366",
    logos: ["excel.png"],
    description:
      "I use Excel for financial modeling, break-even analysis, projections, structured research, target lists, and business analysis where assumptions need to be transparent, flexible, and easy to audit.",
  },
  {
    name: "Word",
    className: "skill-doc",
    slot: "slot-doc",
    accent: "#185abd",
    logos: ["word.png"],
    description:
      "I write structured reports, strategy memos, training manuals, formal documentation, and long-form business deliverables that turn scattered context into clear recommendations, operating plans, and next steps.",
  },
  {
    name: "React",
    className: "skill-react",
    slot: "slot-react",
    accent: "#61dafb",
    logos: ["react.svg"],
    description:
      "I use React to build interactive interfaces with component-based architecture, stateful UI, reusable patterns, and enough attention to user flow that the product feels useful instead of just technically functional.",
  },
];

const portfolioItems: WorkItem[] = [
  {
    index: "01",
    title: "The Pitch Deck",
    meta: "Founder-led platform / NextJS / TypeScript",
    description:
      "A centralized platform for Canadian student opportunities, built with an AI-driven conversational matching layer and scaled to 1,500+ unique site visits.",
    tags: ["55K+ views", "1K+ followers", "AI matching"],
    imageLabel: "TPD",
    imageSrc: "/projects/tpd_screenshot.png",
    projectUrl: "https://thepitchdeck.ca",
    stack: ["NextJS", "TypeScript", "React", "Vercel", "AI chatbot UX"],
    builtFor:
      "Canadian high school students who need a cleaner way to discover selective business, STEM, leadership, and enrichment opportunities.",
    role:
      "Founded the platform, built the front-end experience, shaped the opportunity taxonomy, and recruited an 8-person executive team to support curation and growth.",
    outcome:
      "Reached 1,000+ social followers, 55,000+ views, and 1,500+ unique site visits within the first months of launch.",
  },
  {
    index: "02",
    title: "Vital Signs",
    meta: "Energy scholarship project / 2D pixel game",
    description:
      "An interactive top-down pixel art game built with NextJS and TypeScript to communicate energy systems through play.",
    tags: ["NextJS", "TypeScript", "Pixel art"],
    imageLabel: "VS",
    imageSrc: "/projects/vital_signs_game_screenshot.png",
    projectUrl: "https://vital-signs-eight.vercel.app",
    stack: ["NextJS", "TypeScript", "React state", "2D pixel art", "Game UI"],
    builtFor:
      "An energy scholarship submission designed to make energy systems and decision-making feel interactive instead of abstract.",
    role:
      "Designed and built the top-down game loop, interface, and project presentation as a solo technical build.",
    outcome:
      "Produced a playable web project that translated an energy education concept into an interactive browser experience.",
  },
  {
    index: "03",
    title: "FOES",
    meta: "Business Analyst Intern",
    description:
      "Conducted private equity target research, produced a 40-page business development report, and moved into a paid year-round analyst role.",
    tags: ["75 targets", "40-page report", "CRM"],
    imageLabel: "FOES",
    imageSrc: "/projects/foes_screenshot.png",
    stack: ["Excel", "HubSpot", "Apollo", "Market research", "Strategic reporting"],
    builtFor:
      "A boutique advisory firm looking to sharpen private equity outreach, target prioritization, and business development workflows.",
    role:
      "Analyzed private equity candidates, compiled a ranked list of 75 target firms, and built a 40-page strategic business development report.",
    outcome:
      "Presented findings to firm partners and secured a paid, year-round return offer as a part-time business development analyst.",
  },
];

function useTypewriter(words: string[]) {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIndex];
    const doneTyping = text === current;
    const doneDeleting = text === "";
    const delay = doneTyping && !isDeleting ? 2000 : isDeleting ? 42 : 78;

    const timeout = window.setTimeout(() => {
      if (doneTyping && !isDeleting) {
        setIsDeleting(true);
        return;
      }

      if (doneDeleting && isDeleting) {
        setIsDeleting(false);
        setWordIndex((index) => (index + 1) % words.length);
        return;
      }

      const nextLength = text.length + (isDeleting ? -1 : 1);
      setText(current.slice(0, nextLength));
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [isDeleting, text, wordIndex, words]);

  return text;
}

function useNameTypewriter(name: string) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (text.length === name.length) return;
    const timeout = window.setTimeout(() => {
      setText(name.slice(0, text.length + 1));
    }, 84);

    return () => window.clearTimeout(timeout);
  }, [name, text]);

  return text;
}

function getSkillSlotClass(
  skill: Skill,
  selectedSkill: Skill | null,
  previousSkill: Skill | null,
) {
  if (
    previousSkill &&
    selectedSkill?.name === skill.name &&
    previousSkill.name !== selectedSkill.name
  ) {
    return previousSkill.slot;
  }

  if (
    selectedSkill &&
    previousSkill?.name === skill.name &&
    previousSkill.name !== selectedSkill.name
  ) {
    return selectedSkill.slot;
  }

  return skill.slot;
}

export default function Home() {
  const identity = useTypewriter(identities);
  const typedName = useNameTypewriter("Pranav Thukral.");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [previousSkill, setPreviousSkill] = useState<Skill | null>(null);
  const skillFieldRef = useRef<HTMLDivElement | null>(null);
  const [skillFlight, setSkillFlight] = useState({
    key: 0,
    x: 0,
    y: 0,
    width: 140,
    height: 140,
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhotoIndex((index) => (index + 1) % photos.length);
    }, 3600);

    return () => window.clearInterval(interval);
  }, []);

  const goToPhoto = (direction: "previous" | "next") => {
    setPhotoIndex((index) => {
      if (direction === "previous") {
        return (index - 1 + photos.length) % photos.length;
      }

      return (index + 1) % photos.length;
    });
  };

  const activeDescription = useMemo(
    () =>
      selectedSkill?.description ??
      "",
    [selectedSkill],
  );

  const selectSkill = (
    skill: Skill,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    const fieldRect = skillFieldRef.current?.getBoundingClientRect();
    const buttonRect = event.currentTarget.getBoundingClientRect();

    setPreviousSkill(selectedSkill);
    setSelectedSkill(skill);

    if (!fieldRect) return;

    setSkillFlight((flight) => ({
      key: flight.key + 1,
      x: buttonRect.left - fieldRect.left,
      y: buttonRect.top - fieldRect.top,
      width: buttonRect.width,
      height: buttonRect.height,
    }));
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#hero" aria-label="Pranav Thukral home">
          Pranav Thukral
        </a>
        <nav aria-label="Main navigation">
          <a href="#work">Portfolio</a>
          <a href="#skills">Capabilities</a>
          <a href="#journey">Journey</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <section className="hero section" id="hero">
        <div className="hero-copy">
          <p className="eyeline">
            I am a <span>{identity}</span>
            <span className="cursor" aria-hidden="true" />
          </p>
          <h1>
            {typedName}
            <span className="cursor cursor-name" aria-hidden="true" />
          </h1>
          <p className="role">
            Student @ Waterloo CS/BBA | Innovation Developer @ RBC
          </p>
        </div>

        <div className="photo-module" aria-label="Photo carousel placeholder">
          <div className="photo-frame">
            <button
              aria-label="Previous photo"
              className="carousel-control previous"
              onClick={() => goToPhoto("previous")}
              type="button"
            >
              <ArrowLeftIcon />
            </button>
            <img
              alt={`Carousel photo ${photoIndex + 1}`}
              className="carousel-photo"
              src={photos[photoIndex]}
            />
            <button
              aria-label="Next photo"
              className="carousel-control next"
              onClick={() => goToPhoto("next")}
              type="button"
            >
              <ArrowRightIcon />
            </button>
          </div>
          <div className="photo-footer">
            <div className="photo-dots" aria-hidden="true">
              {photos.map((photo, index) => (
                <span
                  className={index === photoIndex ? "active" : ""}
                  key={photo}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section work" id="work">
        <div className="section-heading compact">
          <p className="section-kicker">01 / Portfolio</p>
          <h2>Portfolio</h2>
        </div>

        <div className="portfolio-grid">
          {portfolioItems.map((item) => (
            <PortfolioCard item={item} key={item.title} />
          ))}
        </div>
        <a className="resume-link" href="/resume.pdf">
          <span>Want to learn more?</span>
          <span aria-hidden="true">-&gt;</span>
        </a>
      </section>

      <section className="section skills" id="skills">
        <div className="section-heading compact">
          <p className="section-kicker">02 / Capabilities</p>
          <h2>What I can do</h2>
        </div>

        <div
          className={`skill-field ${selectedSkill ? "has-selected" : ""}`}
          ref={skillFieldRef}
          style={
            {
              "--flight-x": `${skillFlight.x}px`,
              "--flight-y": `${skillFlight.y}px`,
              "--flight-w": `${skillFlight.width}px`,
              "--flight-h": `${skillFlight.height}px`,
            } as React.CSSProperties
          }
        >
          <div className="skill-stage">
            {selectedSkill ? (
              <div
                className="skill-flyer"
                key={`${selectedSkill.name}-${skillFlight.key}`}
                aria-hidden="true"
              >
                <LogoStack files={selectedSkill.logos} name={selectedSkill.name} />
              </div>
            ) : null}
            <div
              className={`skill-detail ${selectedSkill ? "visible" : ""}`}
              style={
                selectedSkill
                  ? ({ "--skill-accent": selectedSkill.accent } as React.CSSProperties)
                  : undefined
              }
            >
              <div className="skill-detail-head">
                <h3>{selectedSkill?.name ?? ""}</h3>
              </div>
              <p>{activeDescription}</p>
            </div>
            {skills.map((skill) => (
              <div
                className={`skill-cell ${
                  selectedSkill?.name === skill.name ? "is-origin" : ""
                }`}
                key={skill.name}
              >
                <button
                  className={`skill-word ${getSkillSlotClass(
                    skill,
                    selectedSkill,
                    previousSkill,
                  )} ${
                    selectedSkill?.name === skill.name ? "selected" : ""
                  }`}
                  aria-label={skill.name}
                  onClick={(event) => selectSkill(skill, event)}
                  type="button"
                >
                  <LogoStack files={skill.logos} name={skill.name} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section journey" id="journey">
        <div className="section-heading">
          <p className="section-kicker">03 / Journey</p>
          <h2>Like all worthwhile things, my path has been nonlinear.</h2>
          <p>
            Exciting, challenging, uncertain, and formative: the throughline has
            been learning how to build systems around pressure, people, and
            opportunity.
          </p>
        </div>

        <div className="timeline">
          <span className="timeline-axis" aria-hidden="true" />
          {timeline.map((item, index) => (
            <article
              className={`timeline-card ${index % 2 === 0 ? "left" : "right"}`}
              key={`${item.date}-${item.title}`}
            >
              <span className="timeline-arrow" aria-hidden="true" />
              <div className="card-top">
                <div className={`logo-box ${item.iconTone}`}>
                  {item.logoFile ? (
                    <img
                      alt={`${item.title} logo`}
                      src={`/logos/${item.logoFile}`}
                    />
                  ) : (
                    <TimelineIcon tone={item.iconTone} label={item.icon} />
                  )}
                </div>
                <span className="divider" aria-hidden="true" />
                <h3>{item.title}</h3>
              </div>
              <p className="date">{item.date}</p>
              <p>{item.description}</p>
              {item.metrics ? (
                <div className="metrics">
                  {item.metrics.map((metric) => (
                    <span key={metric}>{metric}</span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <footer className="section contact" id="contact">
        <p className="section-kicker">04 / Contact</p>
        <h2>Like what you see? Reach out.</h2>
        <div className="contact-links" aria-label="Contact links">
          <a href="mailto:pranavthukral.pt@gmail.com" aria-label="Email Pranav">
            <img alt="" src="/logos/gmail.svg" />
          </a>
          <a href="https://x.com/_pranavthukral" aria-label="Pranav on X">
            <img alt="" src="/logos/x.svg" />
          </a>
          <a
            href="https://linkedin.com/in/pranavthukral"
            aria-label="Pranav on LinkedIn"
          >
            <img alt="" src="/logos/linkedin.svg" />
          </a>
        </div>
      </footer>
    </main>
  );
}

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function LogoStack({ files, name }: { files: string[]; name: string }) {
  return (
    <span className={`logo-stack ${files.length > 1 ? "multi" : ""}`}>
      {files.map((file) => (
        <img alt="" key={file} src={`/logos/${file}`} />
      ))}
      <span className="sr-only">{name}</span>
    </span>
  );
}

function GmailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path fill="#ea4335" d="M3 6.6 12 13.2l9-6.6V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path fill="#fbbc04" d="M3 6.6A2 2 0 0 1 5 4.6h.8L12 9.2l6.2-4.6H19a2 2 0 0 1 2 2L12 13.2z" />
      <path fill="#34a853" d="M3 7.3 8.7 11.5 3 16z" />
      <path fill="#4285f4" d="M21 7.3 15.3 11.5 21 16z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path fill="currentColor" d="M13.9 10.5 21.3 2h-1.8l-6.4 7.4L8 2H2l7.8 11.3L2 22h1.8l6.8-7.8L16 22h6zM11.5 13l-.8-1.1L4.5 3.3h2.7l5 7 .8 1.1 6.5 9.3h-2.7z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path fill="#0a66c2" d="M20.5 3h-17A1.5 1.5 0 0 0 2 4.5v15A1.5 1.5 0 0 0 3.5 21h17a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 20.5 3" />
      <path fill="#fff" d="M6.1 9.6h3V18h-3zm1.5-4.2a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4M10.8 9.6h2.9v1.2h.1c.4-.7 1.4-1.5 2.8-1.5 3 0 3.5 2 3.5 4.5V18h-3v-3.8c0-.9 0-2.1-1.3-2.1s-1.5 1-1.5 2V18h-3z" />
    </svg>
  );
}

function PortfolioCard({ item }: { item: WorkItem }) {
  return (
    <article className="portfolio-card">
      <div className="portfolio-image">
        <img alt={`${item.title} screenshot`} src={item.imageSrc} />
      </div>
      <div className="portfolio-copy">
        <p>{item.index}</p>
        <h3>{item.title}</h3>
        <span>{item.meta}</span>
        <p>{item.description}</p>
        <details className="portfolio-details">
          <summary>
            <span>Project details</span>
            <span aria-hidden="true">+</span>
          </summary>
          <div className="portfolio-detail-body">
            <div className="detail-row">
              <h4>Stack</h4>
              <div className="tag-row">
                {item.stack.map((stackItem) => (
                  <span key={stackItem}>{stackItem}</span>
                ))}
              </div>
              {item.projectUrl ? (
                <a
                  className="project-link"
                  href={item.projectUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Go to project
                  <span aria-hidden="true">-&gt;</span>
                </a>
              ) : null}
            </div>
            <div className="detail-row">
              <h4>Built For</h4>
              <p>{item.builtFor}</p>
            </div>
            <div className="detail-row">
              <h4>My Role</h4>
              <p>{item.role}</p>
            </div>
            <div className="detail-row">
              <h4>Outcome</h4>
              <p>{item.outcome}</p>
            </div>
          </div>
        </details>
      </div>
    </article>
  );
}

function TimelineIcon({
  label,
  tone,
}: {
  label: string;
  tone: TimelineItem["iconTone"];
}) {
  if (tone === "medical") {
    return (
      <svg aria-label={label} viewBox="0 0 48 48">
        <path className="icon-stroke" d="M17 8v12a7 7 0 0 0 14 0V8" />
        <path className="icon-stroke" d="M13 8h8" />
        <path className="icon-stroke" d="M27 8h8" />
        <path className="icon-stroke" d="M24 27v4a9 9 0 0 0 18 0v-3" />
        <circle className="icon-fill" cx="42" cy="25" r="4" />
      </svg>
    );
  }

  if (tone === "award") {
    return (
      <svg aria-label={label} viewBox="0 0 48 48">
        <path className="icon-fill" d="M15 7h18v11a9 9 0 0 1-18 0z" />
        <path className="icon-stroke" d="M17 34h14" />
        <path className="icon-stroke" d="M24 27v7" />
        <path className="icon-stroke" d="M15 12H8c0 7 3 11 9 11" />
        <path className="icon-stroke" d="M33 12h7c0 7-3 11-9 11" />
      </svg>
    );
  }

  if (tone === "business") {
    return (
      <svg aria-label={label} viewBox="0 0 48 48">
        <path className="icon-fill" d="M10 17h28v21H10z" />
        <path className="icon-stroke" d="M18 17v-5h12v5" />
        <path className="icon-stroke" d="M10 24h28" />
        <path className="icon-stroke" d="M22 27h4" />
      </svg>
    );
  }

  if (tone === "growth") {
    return (
      <svg aria-label={label} viewBox="0 0 48 48">
        <path className="icon-stroke" d="M8 37h32" />
        <path className="icon-stroke" d="M12 32l8-8 7 5 10-15" />
        <path className="icon-fill" d="M33 14h7v7z" />
      </svg>
    );
  }

  if (tone === "network") {
    return (
      <svg aria-label={label} viewBox="0 0 48 48">
        <circle className="icon-fill" cx="13" cy="15" r="5" />
        <circle className="icon-fill" cx="35" cy="16" r="5" />
        <circle className="icon-fill" cx="24" cy="34" r="5" />
        <path className="icon-stroke" d="M18 17l12-1" />
        <path className="icon-stroke" d="M16 20l6 10" />
        <path className="icon-stroke" d="M32 20l-6 10" />
      </svg>
    );
  }

  if (tone === "school") {
    return (
      <svg aria-label={label} viewBox="0 0 48 48">
        <path className="icon-fill" d="M6 19l18-9 18 9-18 9z" />
        <path className="icon-stroke" d="M14 24v8c6 4 14 4 20 0v-8" />
        <path className="icon-stroke" d="M40 21v12" />
      </svg>
    );
  }

  return (
    <svg aria-label={label} viewBox="0 0 48 48">
      <path className="icon-fill" d="M10 16l14-8 14 8v22H10z" />
      <path className="icon-stroke" d="M15 38V20h18v18" />
      <path className="icon-stroke" d="M18 25h12" />
      <path className="icon-stroke" d="M18 31h12" />
    </svg>
  );
}
