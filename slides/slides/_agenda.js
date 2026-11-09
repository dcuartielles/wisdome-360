// A section opener: a numbered list of what is coming, on the front of the dome.
import { C, textSlideMaterial } from './_common.js';
import { header, labEls } from './_lab.js';

export function agendaSlide({ title, act, lesson, items, notes }) {
  return {
    title, act, notes,
    video({ comp, AngleCanvas }) {
      const ac = new AngleCanvas();
      header(ac, title, lesson);
      const top = labEls().lesson - 7.6;            // first row under the lesson, the list centred on the sweet spot
      const half = Math.ceil(items.length / 2);
      items.forEach((s, i) => {
        const col = i < half ? 0 : 1, row = i < half ? i : i - half;
        const az = col === 0 ? -22 : 22, el = top - row * 4.4;
        ac.text(String(i + 1).padStart(2, '0'), az - 15, el, { size: 1.5, weight: 800, color: C.warm, align: 'left' })
          .text(s, az - 11, el, { size: 1.35, weight: 550, color: C.ink, align: 'left' });
      });
      ac.commit();
      const mat = textSlideMaterial(comp, ac);
      return { render: () => mat, dispose() { mat.dispose(); ac.dispose(); } };
    },
  };
}
