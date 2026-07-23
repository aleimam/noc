import { redirect } from 'next/navigation';

// Consolidated into the single canonical new-listing form (owner decision 2026-07-23: one "add"
// flow, defaulting to show on both New Obour + Al Sawarey). This was the New-Obour-first variant
// (showOnBrokerage off by default); it's now redundant and unreachable, so it just redirects.
export default function NewObourNewListingRedirect() {
  redirect('/admin/marketplace/listings/new');
}
