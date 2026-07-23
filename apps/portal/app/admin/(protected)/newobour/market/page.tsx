import { redirect } from 'next/navigation';

// Merged into the single canonical listings page (owner decision 2026-07-23). This was a lighter
// duplicate view of the same Listing data; everything now lives on /admin/marketplace/listings.
export default function NewObourMarketRedirect() {
  redirect('/admin/marketplace/listings');
}
