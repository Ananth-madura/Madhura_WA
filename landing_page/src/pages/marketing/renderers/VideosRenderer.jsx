import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Pause,
  Video,
  Clock,
  User,
  X,
  Search,
  CheckCircle2,
  List,
  FileText,
  ArrowRight,
  ExternalLink,
  Volume2,
  Maximize2,
  Sparkles
} from "lucide-react";
import { resolveRelated } from "../content/index";
import { Section, SectionHeading, StatStrip, CtaBanner, RelatedRail } from "./shared";

export default function VideosRenderer({ page }) {
  const [query, setQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("all");
  const [activeVideo, setActiveVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [modalTab, setModalTab] = useState("chapters"); // chapters | takeaways | transcript

  const videos = page.videos || [];
  const tracks = page.tracks || [];
  const related = resolveRelated(page.related);

  const filteredVideos = useMemo(() => {
    let list = videos;
    if (selectedTrack !== "all") {
      list = list.filter((v) => v.track.toLowerCase() === selectedTrack.toLowerCase());
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          (v.tags && v.tags.some((tag) => tag.toLowerCase().includes(q))) ||
          (v.instructor && v.instructor.toLowerCase().includes(q))
      );
    }
    return list;
  }, [videos, selectedTrack, query]);

  return (
    <>
      <StatStrip stats={page.stats} />

      {/* Hero & Video Tracks Filter */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <SectionHeading
            center
            eyebrow="Video Academy"
            title="Watch, Learn, and Implement in Minutes"
            sub="Visual, bite-sized walkthroughs covering workspace configuration, visual flow canvas design, wave broadcast throttling, and webhook integrations."
          />

          <div className="mt-8 relative max-w-xl mx-auto">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search video guides — 'flows', 'team inbox', 'routing', 'templates'..."
              className="w-full rounded-full border border-slate-200 bg-white pl-11 pr-10 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setSelectedTrack("all")}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                selectedTrack === "all"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              All Video Guides ({videos.length})
            </button>
            {tracks.map((track) => (
              <button
                key={track}
                onClick={() => setSelectedTrack(track)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                  selectedTrack.toLowerCase() === track.toLowerCase()
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {track}
              </button>
            ))}
          </div>
        </div>

        {/* Video Card Grid */}
        <div className="mt-14 max-w-6xl mx-auto">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredVideos.map((vid) => (
              <div
                key={vid.id}
                onClick={() => {
                  setActiveVideo(vid);
                  setIsPlaying(true);
                  setActiveChapterIndex(0);
                  setModalTab("chapters");
                }}
                className="cursor-pointer group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-blue-400 hover:shadow-card transition-all"
              >
                {/* Simulated Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-tr from-[#070b16] via-[#0b1224] to-[#1e293b] p-6 flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                      {vid.track}
                    </span>
                    <span className="text-[11px] font-bold text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Clock size={11} /> {vid.duration}
                    </span>
                  </div>

                  {/* Play Button Icon */}
                  <div className="self-center my-auto z-10">
                    <div className="h-14 w-14 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg shadow-blue-600/50 group-hover:scale-110 group-hover:bg-blue-500 transition-all">
                      <Play size={22} className="ml-1 fill-white" />
                    </div>
                  </div>

                  <div className="z-10 text-[11px] text-slate-300 font-medium truncate">
                    {vid.chapters?.length || 3} Chapters • {vid.instructor}
                  </div>

                  {/* Subtle Grid Pattern Overlay */}
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                </div>

                {/* Card Content */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                      {vid.title}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">
                      {vid.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">{vid.instructor}</span>
                    <span className="font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Watch Video <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredVideos.length === 0 && (
            <div className="text-center py-16">
              <Video size={40} className="mx-auto text-slate-300" />
              <p className="mt-4 text-base font-bold text-slate-800">No videos found for “{query}”</p>
              <button
                onClick={() => {
                  setQuery("");
                  setSelectedTrack("all");
                }}
                className="mt-3 text-xs font-bold text-blue-600 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Interactive Video Player Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="relative w-full max-w-5xl rounded-3xl bg-[#0b1224] text-white shadow-2xl border border-white/10 overflow-hidden max-h-[95vh] flex flex-col">
            {/* Top Bar */}
            <div className="bg-[#070b16] px-6 py-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                  {activeVideo.track}
                </span>
                <span className="text-xs text-slate-300 font-medium truncate max-w-md">
                  {activeVideo.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Player Display */}
            <div className="relative aspect-video w-full bg-black flex flex-col justify-between overflow-hidden">
              {/* Simulated Screen Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="h-16 w-16 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-xl shadow-blue-500/40 mb-3 cursor-pointer hover:scale-105 transition"
                     onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? <Pause size={28} className="fill-white" /> : <Play size={28} className="ml-1 fill-white" />}
                </div>
                <div className="text-sm font-semibold text-white/90">
                  {activeVideo.chapters?.[activeChapterIndex]?.title || activeVideo.title}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Presented by {activeVideo.instructor} • Now Playing
                </div>
              </div>

              {/* Player Controls Bar */}
              <div className="mt-auto z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex flex-col gap-2">
                {/* Scrubber timeline with chapter markers */}
                <div className="w-full bg-white/20 h-1.5 rounded-full relative cursor-pointer">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${((activeChapterIndex + 1) / (activeVideo.chapters?.length || 1)) * 100}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="text-white hover:text-blue-400"
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <span className="font-mono text-[11px]">
                      {activeVideo.chapters?.[activeChapterIndex]?.timestamp || "00:00"} / {activeVideo.duration}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Volume2 size={16} className="text-slate-400 hover:text-white cursor-pointer" />
                    <Maximize2 size={15} className="text-slate-400 hover:text-white cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Video Metadata & Tabs */}
            <div className="p-6 overflow-y-auto flex-1 bg-[#0b1224]">
              {/* Tab navigation */}
              <div className="flex items-center gap-4 border-b border-white/10 pb-3 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setModalTab("chapters")}
                  className={`pb-2 transition border-b-2 ${
                    modalTab === "chapters"
                      ? "border-blue-500 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Chapters ({activeVideo.chapters?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("takeaways")}
                  className={`pb-2 transition border-b-2 ${
                    modalTab === "takeaways"
                      ? "border-blue-500 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Key Takeaways
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("transcript")}
                  className={`pb-2 transition border-b-2 ${
                    modalTab === "transcript"
                      ? "border-blue-500 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Transcript
                </button>
              </div>

              {/* Tab Contents */}
              <div className="mt-4">
                {modalTab === "chapters" && (
                  <div className="space-y-2">
                    {activeVideo.chapters?.map((ch, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setActiveChapterIndex(idx);
                          setIsPlaying(true);
                        }}
                        className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                          activeChapterIndex === idx
                            ? "bg-blue-600/20 border-blue-500/50 text-white font-bold"
                            : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-cyan-400">{ch.timestamp}</span>
                          <span>{ch.title}</span>
                        </div>
                        {activeChapterIndex === idx && (
                          <span className="text-[10px] text-blue-400 font-semibold uppercase">
                            Playing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {modalTab === "takeaways" && (
                  <div className="space-y-3">
                    {activeVideo.takeaways?.map((takeaway, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                        <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{takeaway}</span>
                      </div>
                    ))}
                  </div>
                )}

                {modalTab === "transcript" && (
                  <div className="text-xs text-slate-300 space-y-3 leading-relaxed max-h-60 overflow-y-auto pr-2">
                    {activeVideo.transcript?.map((line, idx) => (
                      <p key={idx}>{line}</p>
                    )) || (
                      <p className="text-slate-400 italic">
                        Full closed captions and timestamped transcript are available during playback.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
