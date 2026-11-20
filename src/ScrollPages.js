import React, {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Page } from "react-pdf";

// Keep a measured slot for every page, but only allocate canvases near the viewport.
const Sheet = memo(function Sheet({ number, visible, width, rotation }) {
  const [shape, setShape] = useState(null);
  const angle = ((shape?.angle || 0) + rotation) % 360;
  let ratio = shape?.ratio || 0.75;
  if (angle % 180) ratio = 1 / ratio;
  return (
    <div
      className="page-slot"
      data-sheet={number}
      style={{ width, aspectRatio: ratio }}
    >
      {visible && (
        <Page
          suspense={false}
          loading={null}
          pageNumber={number}
          width={width}
          rotate={shape ? angle : undefined}
          devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
          onLoadSuccess={(p) => {
            const v = p.getViewport({ scale: 1, rotation: 0 });
            setShape(
              (old) => old || { ratio: v.width / v.height, angle: p.rotate },
            );
          }}
        />
      )}
    </div>
  );
});

export default function ScrollPages({
  pdf,
  width,
  rotation,
  viewport,
  page,
  onPage,
}) {
  const stack = useRef(null),
    initial = useRef(page),
    current = useRef(page),
    notify = useRef(onPage);
  const [near, setNear] = useState(() => new Set([page]));
  useLayoutEffect(() => {
    current.current = page;
    notify.current = onPage;
  }, [page, onPage]);
  useLayoutEffect(() => {
    stack.current.children[initial.current - 1]?.scrollIntoView({
      block: "start",
    });
  }, []);
  useEffect(() => {
    const el = viewport.current,
      slots = stack.current.children;
    const observer = new IntersectionObserver(
      (entries) =>
        setNear((old) => {
          const copy = new Set(old);
          for (const e of entries) {
            const n = Number(e.target.dataset.sheet);
            if (e.isIntersecting) copy.add(n);
            else copy.delete(n);
          }
          return copy;
        }),
      { root: el, rootMargin: "100% 0px" },
    );
    for (const slot of slots) observer.observe(slot);
    function scrolled() {
      // First page intersecting the viewport's top edge.
      const top = el.getBoundingClientRect().top + 1;
      let lo = 0,
        hi = slots.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (slots[mid].getBoundingClientRect().bottom <= top) lo = mid + 1;
        else hi = mid;
      }
      const n =
        el.scrollTop > 0 &&
        el.scrollTop + el.clientHeight >= el.scrollHeight - 1
          ? slots.length
          : lo + 1;
      if (n !== current.current) {
        current.current = n;
        notify.current(n);
      }
    }
    el.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", scrolled);
    };
  }, [viewport]);
  return (
    <div ref={stack}>
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <Sheet
          key={i}
          number={i + 1}
          visible={near.has(i + 1)}
          width={width}
          rotation={rotation}
        />
      ))}
    </div>
  );
}
