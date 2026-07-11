// Storefront contact helpers: the central WhatsApp number + wa.me link builder.
import { waPhone } from '@noc/config';

export const WHATSAPP = '+201040810000';

export function waLink(text: string, number: string = WHATSAPP): string {
  return `https://wa.me/${waPhone(number)}?text=${encodeURIComponent(text)}`;
}
