"use client";

/* eslint-disable @next/next/no-img-element -- cells draw =IMAGE() results, which can be any URL a visitor types, so next/image (which needs known hosts and sizes) doesn't fit. */

import type { KeyboardEvent, ReactNode, Ref } from "react";
import { TECH_BRANDS, gantt, monthLabel, phone, type Cells, type Section } from "./content";
import { display } from "./display";
import { ImageValue, type Lookup } from "./formula";
import { Brand, Icon } from "./icons";
import { Mark } from "./marks";

// The phone layout: the same live cells as the grid, laid out per section. Tapping a field selects its cell,
// while the formula playground opens the fx bar. Grid view offers editing for every cell.

type Bar = { row: number; name: string; start: string; tone: string; s: number; e: number; ongoing: boolean };

type Props = {
  sections: Section[];
  cells: Cells;
  value: Lookup;
  curId: string;
  bugCells: Set<string>;
  bars: Bar[];
  playCell: string;
  mailto: (send: { name: string; message: string }) => string;
  onSelect: (id: string) => void;
  onPlay: (id: string) => void;
  onToggle: (id: string) => void;
  onSet: (id: string, v: string) => void;
  scrollRef: Ref<HTMLDivElement>;
  sectionRef: (id: string, el: HTMLElement | null) => void;
};

export function CardsView(props: Props) {
  const { sections, cells, value, curId, bugCells, bars, playCell, mailto, onSelect, onPlay, onToggle, onSet, scrollRef, sectionRef } = props;
  const text = (id: string) => display(value(id), cells[id]);
  const raw = (id: string) => cells[id]?.v ?? "";
  /** A cell's text with its logo, brand mark or icon in front, as the grid shows it. */
  const marked = (id: string, cls = "field-mark") => (
    <>
      <Mark style={cells[id]?.s} className={cls} />
      {text(id)}
    </>
  );

  const field = (id: string, children: ReactNode, className = "") => (
    <Field key={id} id={id} selected={curId === id} bug={bugCells.has(id)} onSelect={onSelect} className={className}>
      {children}
    </Field>
  );

  const chip = (id: string, className = "card-chip") => {
    const st = cells[id]?.s;
    const href = st?.send ? mailto(st.send) : (st?.href ?? "#");
    return (
      <a key={id} className={className} href={href} target={href.startsWith("/") || href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">
        <Mark style={st} className="card-chip-icon" />
        <span>{text(id)}</span>
      </a>
    );
  };

  const unlock = (id: string) =>
    text(id) ? (
      <p key={id} className="card-unlock">
        {text(id)}
      </p>
    ) : null;

  const hero = () => {
    const h = phone.hero;
    return (
      <div className="card hero-card">
        {field(h.name, <span className="hero-name">{text(h.name)}</span>)}
        {field(h.sub, <span className="hero-sub">{text(h.sub)}</span>)}
        <p className="hero-note">{h.note}</p>
        <div className="kpis">
          {h.tiles.map((id, i) => {
            const st = cells[id]?.s;
            // Long figures take a full row; so does a last tile that would otherwise sit alone.
            const wide = (t: string) => display(value(t), cells[t]).length > 8;
            const before = h.tiles.slice(0, i).filter((t) => !wide(t)).length;
            const alone = i === h.tiles.length - 1 && !wide(id) && before % 2 === 0;
            return field(
              id,
              <>
                <Mark style={st} className="kpi-icon" />
                <span className="kpi-value" style={{ "--tone": st?.color } as React.CSSProperties}>
                  {text(id)}
                </span>
                <span className="kpi-label">{st?.caption}</span>
              </>,
              `kpi-tile${wide(id) || alone ? " is-wide" : ""}`,
            );
          })}
        </div>
        <div className="hero-links">{h.links.map((id, i) => chip(id, i === 0 ? "card-chip is-primary" : "card-chip"))}</div>
        <Field id={playCell} selected={curId === playCell} bug={false} onSelect={onPlay} className="play">
          <span className="play-label">Try a formula</span>
          <span className="play-value">{text(playCell) || "Tap, then type in the fx bar. Try =AMBITION()"}</span>
        </Field>
      </div>
    );
  };

  const gallery = () => [
    ...phone.projects.map((p) => {
      const thumb = value(p.thumb);
      return (
        <article key={p.title} className="card project-card">
          {field(
            p.thumb,
            thumb instanceof ImageValue ? <img src={thumb.src} alt="" loading="lazy" /> : <span className="thumb-error">{text(p.thumb) || "No image"}</span>,
            "project-thumb",
          )}
          <div className="project-head">
            {field(p.title, text(p.title), "project-title")}
            {field(
              p.pill,
              <span className="pill">
                <span className="pill-dot" />
                {text(p.pill)}
              </span>,
            )}
          </div>
          {field(p.desc, text(p.desc), "project-desc")}
          {field(
            p.tags,
            <span className="tags">
              {text(p.tags)
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <span key={t} className="tag">
                    {TECH_BRANDS[t] && <Brand name={TECH_BRANDS[t]} className="tag-mark" />}
                    {t}
                  </span>
                ))}
            </span>,
          )}
          <div className="project-metric">
            {field(p.metricLabel, text(p.metricLabel), "is-muted")}
            {field(p.metric, text(p.metric), "is-figure")}
          </div>
          {chip(p.link)}
        </article>
      );
    }),
    unlock(phone.projectsReward),
  ];

  const timeline = () => {
    const pct = (m: number) => `${(m / gantt.months) * 100}%`;
    return [
      <div key="gantt" className="card gantt-card">
        <div className="gantt-scale">
          <span>{monthLabel(0)}</span>
          <span>{monthLabel(gantt.months - 1)}</span>
        </div>
        {bars.map((b) => (
          <div key={b.row} className="gantt-row" style={{ "--tone": b.tone } as React.CSSProperties}>
            {field(b.name, marked(b.name), "gantt-name")}
            <div className="gantt-track">
              <span className="gantt-today" style={{ left: pct(gantt.today + 0.5) }} />
              {b.s >= 0 && (
                <span
                  className={`gantt-fill${b.ongoing ? " is-ongoing" : ""}${bugCells.has(b.start) ? " has-bug" : ""}`}
                  style={{ left: pct(b.s), width: pct(b.e - b.s + 1) }}
                />
              )}
            </div>
          </div>
        ))}
        <p className="gantt-legend">The line marks now. Bars can be dragged in Grid view.</p>
      </div>,
      ...phone.timeline.details.map((d) => (
        <article key={d.role} className="card record">
          {field(d.role, marked(d.role), "record-title")}
          {field(d.when, text(d.when), "record-when")}
          {field(d.what, text(d.what), "record-what")}
          {field(d.result, text(d.result), "is-figure")}
        </article>
      )),
      unlock(phone.timeline.reward),
    ];
  };

  const skills = () => {
    const values = phone.skills.rows.map((row) => {
      const v = value(row.uses);
      return typeof v === "number" ? v : null;
    });
    const max = Math.max(1, ...values.map((v) => v ?? 0));
    return [
      <ul key="list" className="card list-card">
        {phone.skills.rows.map((row, i) => (
          <li key={row.name} className="list-row">
            <div className="list-main">
              {field(row.name, marked(row.name), "list-name")}
              {field(row.kind, text(row.kind), "list-kind")}
            </div>
            <div className="list-chips">{row.ticks.filter((t) => text(t.id)).map((t) => field(t.id, t.label, "chip-field"))}</div>
            <div className="list-bar">
              <span style={{ width: `${((values[i] ?? 0) / max) * 100}%` }} />
            </div>
            {field(row.uses, values[i] ?? "?", "list-count")}
          </li>
        ))}
      </ul>,
      <div key="total" className="card-foot">
        <span className="is-muted">Total</span>
        {field(phone.skills.total, text(phone.skills.total), "is-figure")}
      </div>,
      unlock(phone.skills.reward),
    ];
  };

  const about = () => {
    const a = phone.about;
    return [
      <div key="pairs" className="card pairs-card">
        {a.pairs.map((p) => (
          <div key={p.key} className="pair">
            {field(p.key, marked(p.key), "pair-key")}
            <div className="pair-values">
              {field(p.value, marked(p.value))}
              {text(p.amount) && field(p.amount, text(p.amount), "is-figure")}
              {cells[p.value]?.s?.note && <span className="pair-note">{cells[p.value]!.s!.note}</span>}
            </div>
          </div>
        ))}
        <div className="pair is-total">
          <div className="pair-values">
            {field(a.total.label, text(a.total.label), "is-muted")}
            {field(a.total.value, text(a.total.value), "is-figure")}
          </div>
        </div>
      </div>,
      <div key="hobbies" className="card hobby-card">
        <span className="pair-key">Off the clock</span>
        <div className="hobbies">
          {a.hobbies.map((h) => {
            const on = value(h.box) === true;
            return (
              <button key={h.box} type="button" className={`hobby${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => onToggle(h.box)}>
                <span className="checkbox">{on && <Icon name="checkBold" className="checkbox-icon" />}</span>
                {text(h.label)}
              </button>
            );
          })}
        </div>
      </div>,
      unlock(a.reward),
      <div key="links" className="card links-card">
        <span className="pair-key">Find me</span>
        <div className="hero-links">{a.links.map((id) => chip(id))}</div>
      </div>,
      <div key="form" className="card form-card">
        <span className="pair-key">Say hi</span>
        {/* The inputs edit what's typed in the cells, not the evaluated value, so "=" or "1.234" don't get rewritten mid-typing. */}
        <input className="form-input" placeholder="Your name" value={raw(a.form.name)} onChange={(e) => onSet(a.form.name, e.target.value)} aria-label="Your name" />
        <textarea
          className="form-input"
          placeholder="A short message"
          rows={3}
          value={raw(a.form.message)}
          onChange={(e) => onSet(a.form.message, e.target.value)}
          aria-label="Message"
        />
        {chip(a.form.send, "card-chip is-primary")}
      </div>,
    ];
  };

  const body = { hero, gallery, timeline, list: skills, pairs: about };

  return (
    <div className="cards" ref={scrollRef}>
      {sections.map((s) => (
        <section
          key={s.id}
          ref={(el) => sectionRef(s.id, el)}
          className={`card-section is-${s.mobile}`}
          style={{ "--tone": s.tone } as React.CSSProperties}
          aria-label={s.name}
        >
          {s.mobile !== "hero" && <h2 className="card-band">{s.name}</h2>}
          {body[s.mobile]()}
        </section>
      ))}
    </div>
  );
}

function Field({
  id,
  selected,
  bug,
  onSelect,
  className,
  children,
}: {
  id: string;
  selected: boolean;
  bug: boolean;
  onSelect: (id: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      title={id}
      className={["field", className, selected && "is-selected", bug && "has-bug"].filter(Boolean).join(" ")}
      onClick={() => onSelect(id)}
      onKeyDown={onKey}
    >
      {children}
    </span>
  );
}
