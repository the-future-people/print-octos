import businessCards from '../assets/business-cards.jpg'
import flexyBanner from '../assets/flexy-banner.jpg'
import idCards from '../assets/id-cards.jpg'
import savSticker from '../assets/sav-sticker.jpg'
import flyers from '../assets/flyers.jpg'

/**
 * A photograph for each service.
 *
 * Catalogue imagery is brand material, not customer data, so it ships
 * with the storefront rather than being uploaded. The media route the
 * backend serves uploads through checks who is asking — right for a
 * customer's artwork, wrong for a picture meant to be seen by
 * strangers.
 *
 * Matched on the service name. Anything unmatched falls back to the
 * plain block, which is quiet rather than broken.
 */
const BY_KEYWORD = [
  [['flexy', 'banner', 'flex'], flexyBanner],
  [['sav', 'sticker', 'label', 'vinyl'], savSticker],
  [['id card', 'id-card'], idCards],
  [['business card', 'biz-card', 'complimentary'], businessCards],
  [['flyer', 'leaflet'], flyers],
]

export function serviceImage(name = '') {
  const n = name.toLowerCase()
  for (const [keywords, image] of BY_KEYWORD) {
    if (keywords.some(k => n.includes(k))) return image
  }
  return null
}