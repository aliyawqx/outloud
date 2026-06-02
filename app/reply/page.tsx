import { ReplyComposer } from '@/components/reply/ReplyComposer'

export const metadata = {
  title: 'Outloud — Reply Composer',
}

export default function ReplyPage() {
  return (
    <main className="wrap" style={{ paddingTop: 56, paddingBottom: 80, maxWidth: 760 }}>
      <div className="kicker" style={{ marginBottom: 18 }}>
        reply composer
      </div>
      <h1 className="h-sec" style={{ marginBottom: 12 }}>
        Reply like you — and get noticed.
      </h1>
      <p className="lede" style={{ marginBottom: 36 }}>
        The fastest way to your first followers is sharp replies under bigger accounts. Paste a post, get one
        witty reply in your voice — then post it on X yourself.
      </p>
      <ReplyComposer />
    </main>
  )
}
