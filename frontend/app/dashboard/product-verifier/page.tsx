import { redirect } from 'next/navigation';

// Redirect old product-verifier URL to new product-finder
export default function ProductVerifierRedirect() {
  redirect('/dashboard/product-finder');
}
