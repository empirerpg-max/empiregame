import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Empire TV" },
      { name: "description", content: "Empire TV — transmissões ao vivo do Empire." },
    ],
  }),
  component: TvPage,
});

function TvPage() {
  return (
    <div className="fixed inset-0 top-[calc(4rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] bg-black">
      <iframe
        src="https://empiretv.vercel.app/"
        title="Empire TV"
        className="w-full h-full border-0 block"
        allow="autoplay; camera; microphone; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
