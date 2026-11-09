import { agendaSlide } from '../_agenda.js';
import { ACT5 } from '../_lab.js';

export default agendaSlide({
  title: 'Limits you can show',
  act: ACT5,
  lesson: 'every medium has edges — show them, then use them',
  items: ['Spatial aliasing', 'The fisheye samples unevenly', 'Frames: wagon wheels and judder', 'Black isn’t black', 'The dome lights itself', 'Vection: the room moves', 'Only one true seat', 'The tilt bends the horizon', 'Sound has no height', 'Colour fringes (DLP)'],
  notes: `<p>Ten short demos. Each slide has live controls on the left: push them until the system breaks, and ask the room what they see.</p>
<p>Most of these only show properly <b>in the dome</b>: the laptop preview is too small and too sharp. Where a slide has a <b>simulate</b> toggle, it is for rehearsing on the laptop only.</p>
<p>Readings: topic 4 in <code>outputs/07-readings/reading-list.docx</code> (Watson et al. 1986 on sampled motion; Keshavarz et al. 2015 on vection), plus Lantz 2007.</p>`,
});
