"use client";

/**
 * lib-video — one video: an uploaded file or a YouTube / Vimeo / Instagram /
 * TikTok / Facebook link, `contained` under a heading or `full` edge to edge
 * with the copy over a scrim.
 *
 * Reuses lib-ugc-carousel's `resolveVideoEmbed` and `autoplayAllowed`, so the
 * setting takes the same `video_picker` value as a reel. Autoplay is decided
 * after mount (never on the server or the first client render): the merchant
 * setting must be on AND the visitor must allow motion and data. A file then
 * plays muted, looped, without controls, only while at least half of it is on
 * screen. Otherwise a file gets native controls and `preload="none"`.
 */

import { useEffect, useRef, useState } from "react";

import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, bool, imageUrl, localized, responsiveImg, str } from "../_shared";
import type { LibrarySectionProps } from "../index";
import { autoplayAllowed, resolveVideoEmbed } from "../lib-ugc-carousel/media";

const STYLES = ["contained", "full"];
const ASPECTS = ["16-9", "4-5", "1-1", "9-16"];
const POSTER_IMG = { widths: [640, 1024, 1280, 1920], sizes: "100vw" } as const;

const CSS = `
.lib-video{padding-block:3rem}
@media (min-width:768px){.lib-video{padding-block:4rem}}
.lib-video.is-full{padding-block:0}
.lib-video-head{margin-block-end:1.5rem;text-align:start}
.lib-video-head .lib-heading{font-size:clamp(1.5rem,2.6vw,1.875rem)}
.lib-video-head p{margin:.5rem 0 0;max-inline-size:60ch}
.lib-video-frame{position:relative;overflow:hidden;aspect-ratio:var(--lib-video-r);max-inline-size:min(100%,calc(88vh * var(--lib-video-r)));margin-inline:auto;background:#000}
.lib-video-frame.is-16-9{--lib-video-r:16/9}
.lib-video-frame.is-4-5{--lib-video-r:4/5}
.lib-video-frame.is-1-1{--lib-video-r:1/1}
.lib-video-frame.is-9-16{--lib-video-r:9/16}
.lib-video.is-full .lib-video-frame{max-inline-size:none;max-block-size:88vh}
.lib-video-fill{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover;border:0}
.lib-video-overlay{position:absolute;inset-inline:0;inset-block-start:0;padding:clamp(1.25rem,4vw,3rem);padding-block-end:4rem;color:#fff;text-align:start;background:linear-gradient(to bottom,rgba(0,0,0,.6),transparent);pointer-events:none}
.lib-video-overlay>*{pointer-events:auto}
.lib-video-overlay .lib-heading{font-size:clamp(1.5rem,4vw,3rem);max-inline-size:20ch}
.lib-video-overlay p{margin:.75rem 0 0;max-inline-size:50ch}
`;

function FileVideo({ src, poster, label, autoplay }: { src: string; poster?: string; label: string; autoplay: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    setAuto(autoplay && autoplayAllowed());
  }, [autoplay]);

  useEffect(() => {
    const el = ref.current;
    if (!auto || !el) return;
    el.muted = true;
    const play = () => void el.play().catch(() => setAuto(false));
    if (typeof IntersectionObserver === "undefined") {
      play();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) play();
        else el.pause();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [auto, src]);

  return (
    <video
      ref={ref}
      className="lib-video-fill"
      src={src}
      poster={poster}
      preload="none"
      playsInline
      controls={!auto}
      muted={auto}
      loop={auto}
      aria-label={label}
    />
  );
}

export default function Video({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const autoplay = bool(s.autoplay, false);

  // Embeds get autoplay params only after mount, so hydration matches.
  const [embedAutoplay, setEmbedAutoplay] = useState(false);
  useEffect(() => {
    setEmbedAutoplay(autoplay && autoplayAllowed());
  }, [autoplay]);

  const video = resolveVideoEmbed(s.video, { autoplay: embedAutoplay });
  if (!video) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(
            locale,
            "Add a video file or a YouTube, Vimeo, Instagram, TikTok or Facebook link",
            "حط ملف فيديو أو لينك من يوتيوب أو فيميو أو إنستجرام أو تيك توك أو فيسبوك",
          )}
        </p>
      </section>
    ) : null;
  }

  const style = STYLES.includes(str(s.style)) ? str(s.style) : "contained";
  const aspect = ASPECTS.includes(str(s.aspect)) ? str(s.aspect) : "16-9";
  const heading = str(s.heading);
  const text = str(s.text);
  const label = heading || localized(locale, "Video", "فيديو");
  const posterUrl = imageUrl(s.poster) || video.poster;
  const poster = posterUrl ? responsiveImg(posterUrl, POSTER_IMG).src : undefined;

  const copy = (heading || text) && (
    <>
      {heading && (
        <h2 className="lib-heading">
          <InlineText sectionId={sectionId} settingKey="heading" value={heading} />
        </h2>
      )}
      {text && (
        <p className={style === "full" ? undefined : "lib-muted"}>
          <InlineText sectionId={sectionId} settingKey="text" value={text} multiline />
        </p>
      )}
    </>
  );

  const frame = (
    <div className={`lib-video-frame is-${aspect}`}>
      {video.kind === "file" ? (
        <FileVideo src={video.src} poster={poster} label={label} autoplay={autoplay} />
      ) : (
        <iframe
          src={video.src}
          title={label}
          className="lib-video-fill"
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; clipboard-write; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      {style === "full" && copy && <div className="lib-video-overlay">{copy}</div>}
    </div>
  );

  return (
    <section className={`lib-section lib-video is-${style}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-video" css={CSS} />
      {style === "full" ? (
        frame
      ) : (
        <div className="lib-container">
          {copy && <div className="lib-video-head">{copy}</div>}
          {frame}
        </div>
      )}
    </section>
  );
}
