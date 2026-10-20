import businessCards from '../assets/business-cards.jpg'
import flexyBanner from '../assets/flexy-banner.jpg'
import idCards from '../assets/id-cards.jpg'
import savSticker from '../assets/sav-sticker.jpg'
import flyers from '../assets/flyers.jpg'
import pullUpBanner from '../assets/pull-up-banner.jpg'
import letterheads from '../assets/letterheads.jpg'
import passportPhotos from '../assets/passport-photos.jpg'
import books from '../assets/books.jpg'
import dtf from '../assets/dtf.jpg'
import embroidery from '../assets/embroidery.jpg'
import lamination from '../assets/lamination.jpg'
import ringBinding from '../assets/ring-binding.jpg'
import slideBinding from '../assets/slide-binding.jpg'
import a3Colour from '../assets/a3-colour.jpg'
import a3BlackWhite from '../assets/a3-bw.jpg'
import a4Colour from '../assets/a4-colour.jpg'
import a4BlackWhite from '../assets/a4-bw.jpg'

/**
 * A photograph for each service.
 *
 * Catalogue imagery is brand material, not customer data, so it ships
 * with the storefront rather than being uploaded. The media route the
 * backend serves uploads through checks who is asking — right for a
 * customer's artwork, wrong for a picture meant to be seen by
 * strangers.
 *
 * Matched on the service name, first match wins, so the order matters:
 * the specific before the general. "Pull-up banner" before "banner",
 * "A4 Flyers" and "A4 Lamination" before plain "A4", black and white
 * before colour. Anything unmatched falls back to the paper badge.
 */
const BY_KEYWORD = [
  [['pull-up', 'pull up', 'roll-up', 'roll up'], pullUpBanner],
  [['flexy', 'banner', 'flex'], flexyBanner],
  [['sav', 'sticker', 'label', 'vinyl'], savSticker],
  [['id card', 'id-card'], idCards],
  [['business card', 'biz-card', 'complimentary'], businessCards],
  [['letterhead'], letterheads],
  [['flyer', 'leaflet'], flyers],
  [['passport'], passportPhotos],
  [['book', 'magazine'], books],
  [['dtf'], dtf],
  [['embroider'], embroidery],
  [['laminat'], lamination],
  [['slide binding', 'slide-binding'], slideBinding],
  [['binding', 'comb'], ringBinding],
  [['a3 b&w', 'a3 black'], a3BlackWhite],
  [['a3'], a3Colour],
  [['a4 b&w', 'a4 black', 'black & white', 'black and white'], a4BlackWhite],
  [['a4 colo', 'a4'], a4Colour],
]

export function serviceImage(name = '') {
  const n = name.toLowerCase()
  for (const [keywords, image] of BY_KEYWORD) {
    if (keywords.some(k => n.includes(k))) return image
  }
  return null
}