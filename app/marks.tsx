/* eslint-disable @next/next/no-img-element -- tiny fixed-height logos from /public; next/image's sizing adds nothing here. */

import type { Style } from "./content";
import { Brand, Icon } from "./icons";

/** What sits before a cell's text: organisation logos, a brand's own mark, or a Fluent icon (in that order). */
export function Mark({ style, className }: { style?: Style; className: string }) {
  const logos = style?.logo ? (Array.isArray(style.logo) ? style.logo : [style.logo]) : [];
  if (logos.length)
    return (
      <span className={`${className} logos`}>
        {logos.map((src) => (
          <img key={src} className="logo" src={src} alt="" draggable={false} />
        ))}
      </span>
    );
  if (style?.brand) return <Brand name={style.brand} className={className} />;
  if (style?.icon) return <Icon name={style.icon} className={className} />;
  return null;
}
