import { permanentRedirect } from 'next/navigation'

// Preserve legacy links; the expanded content lives at the canonical legal route.
export default function ReturnsPage() {
  permanentRedirect('/iade-ve-degisim')
}
