import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Instagram, 
  Twitter, 
  Video, 
  Plus, 
  Heart, 
  MessageCircle, 
  Share2, 
  BarChart3, 
  X,
  Image as ImageIcon,
  Send,
  MoreVertical,
  Newspaper,
  ImageOff,
  UserCircle,
  ChevronRight,
  ChevronLeft,
  Grid3x3,
  BadgeCheck,
  Play,
  Music2,
  Repeat2,
  Film,
  Tag,
} from "lucide-react";

function formatCount(n: number | undefined): string {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(v);
}
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/social")({
  component: SocialPage,
});

type Post = {
  id: string;
  tipo: "Instagram" | "Twitter" | "TikTok";
  subtipo?: string;
  autor: string;
  handle: string;
  avatar?: string;
  texto: string;
  media_url?: string;
  analytics: { likes: number; comments: number; shares: number };
  data: string;
};

// ✅ Correção: Tipagem flexível para capturar os dados, não importa como venham do banco
type SocialProfile = {
  artista: string;
  rede: string;
  handle: string;
  bio: string;
  avatar_url?: string;
  avatar?: string;
  foto?: string;
  seguidores?: number;
  seguindo?: number;
};

type News = {
  id: string;
  titulo: string;
  conteudo: string;
  imagem: string;
  autor: string;
  data: string;
};

function SocialPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"Instagram" | "Twitter" | "TikTok" | null>(null);
  const [igMode, setIgMode] = useState<"Feed" | "Story">("Feed");
  const [postText, setPostText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [myArtists, setMyArtists] = useState<any[]>([]);
  const [selectedArtist, setSelectedArtist] = useState("");
  const [viewMode, setViewMode] = useState<"Feed" | "Settings" | "News" | "Industry">("Feed");
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [allArtists, setAllArtists] = useState<any[]>([]);
  const [selectedIndustryArtist, setSelectedIndustryArtist] = useState<any | null>(null);
  const [industryViewTab, setIndustryViewTab] = useState<"Instagram" | "Twitter" | "TikTok" | null>(null);
  const [news, setNews] = useState<News[]>([]);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  
  // News form
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsImage, setNewsImage] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfileInfo, setEditingProfileInfo] = useState<{ artista: string; rede: string } | null>(null);
  const [profileHandle, setProfileHandle] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [activeArtist, setActiveArtist] = useState<any | null>(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [profileFollowers, setProfileFollowers] = useState("0");
  const [profileFollowing, setProfileFollowing] = useState("0");
  const [columns, setColumns] = useState(1);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const { user, ready } = useTelegramUser();

  useEffect(() => {
    loadPosts();
    loadNews();
  }, []);

  useEffect(() => {
    if (ready) loadContext();
  }, [ready, user]);

  async function loadContext() {
    const tgId = user?.id || "";
    const arts = await api.meusArtistas(tgId);
    setMyArtists(arts);
    
    const allArts = await api.listarTodos();
    setAllArtists(allArts);
    
    if (arts.length > 0 && !activeArtist) {
      setActiveArtist(arts[0]);
      setSelectedArtist(arts[0].nome);
    }
    
    const profs = await (api as any).listarPerfisSocial();
    setProfiles(profs);
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const data = await (api as any).listarPostsSocial();
      if (Array.isArray(data)) setPosts(data);
    } catch (err) {
      console.error("Erro ao carregar posts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadNews() {
    try {
      const data = await (api as any).listarNewsSocial();
      if (Array.isArray(data)) setNews(data);
    } catch (err) {
      console.error("Erro ao carregar news:", err);
    }
  }

  async function loadComments(postId: string) {
    const data = await (api as any).listarComentariosSocial(postId);
    setComments(data);
  }

  async function handleLike(postId: string) {
    const tgId = user?.id || "";
    const res = await (api as any).curtirPostSocial(postId, tgId);
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, likes: res.likes } } : p));
    }
  }

  async function handleAddComment() {
    if (!selectedPost || !newComment.trim() || !activeArtist || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        postId: selectedPost.id,
        autor: activeArtist.nome,
        texto: newComment
      };
      const tgId = user?.id || "";
      const res = await (api as any).comentarPostSocial(payload, tgId);
      if (res.ok) {
        setNewComment("");
        loadComments(selectedPost.id);
        setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, analytics: { ...p.analytics, comments: p.analytics.comments + 1 } } : p));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveProfile() {
    if (!editingProfileInfo || submitting) return;
    setSubmitting(true);
    try {
      // ✅ Correção: Enviamos os dados com várias chaves pro Apps Script mapear sem problemas
      const p: any = {
        artista: editingProfileInfo.artista,
        rede: editingProfileInfo.rede,
        handle: profileHandle || "@",
        avatar_url: profileAvatar || "",
        avatar: profileAvatar || "", 
        foto: profileAvatar || "",
        bio: profileBio || "",
        seguindo: Number(profileFollowing) || 0,
      };
      const tgId = user?.id || "";
      const res = await (api as any).salvarPerfilSocial(p, tgId);
      if (res.ok) {
        setIsProfileModalOpen(false);
        loadContext();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost() {
    if (!selectedType || !postText.trim() || !activeArtist || submitting) return;
    
    setSubmitting(true);
    const tgId = user?.id || "";
    
    try {
      const payload = {
        tipo: selectedType,
        subtipo: selectedType === "Instagram" ? igMode : undefined,
        autor: activeArtist.nome,
        texto: postText,
        media_url: imageUrl,
        analytics: { likes: 0, comments: 0, shares: 0 }
      };

      const res = await (api as any).salvarPostSocial(payload, tgId);
      if (res.ok) {
        setIsModalOpen(false);
        setSelectedType(null);
        setPostText("");
        setImageUrl("");
        loadPosts();
      }
    } catch (err) {
      console.error("Erro ao postar:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveNews() {
    if (!newsTitle.trim() || !newsContent.trim() || !activeArtist || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        titulo: newsTitle,
        conteudo: newsContent,
        imagem: newsImage,
        autor: activeArtist.nome
      };
      const tgId = user?.id || "";
      const res = await (api as any).salvarNewsSocial(payload, tgId);
      if (res.ok) {
        setIsNewsModalOpen(false);
        setNewsTitle("");
        setNewsContent("");
        setNewsImage("");
        loadNews();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const driveImg = (url: string | null | undefined) => {
    if (!url) return undefined;
    if (url.includes("lh3.googleusercontent.com")) return url;
    const m = String(url).match(/[-\w]{25,}/);
    if (!m) return url;
    return `https://lh3.googleusercontent.com/d/$${m[0]}=w600`;
  };

  const getPostStyles = (tipo: string) => {
    if (tipo === "Twitter") return "bg-white text-black border-[#3D8BFF] shadow-[6px_6px_0px_#B9E2FF] active:shadow-[2px_2px_0px_#B9E2FF]";
    if (tipo === "Instagram") return "bg-white text-black border-[#FF4757] shadow-[6px_6px_0px_#FFE0E0] active:shadow-[2px_2px_0px_#FFE0E0]";
    if (tipo === "TikTok") return "bg-white text-black border-black shadow-[6px_6px_0px_#000] active:shadow-[2px_2px_0px_#000]";
    return "bg-white text-black border-black shadow-[7px_7px_0px_#000] active:shadow-[2px_2px_0px_#000]";
  };

  const neoCard = "border-[3.5px] rounded-[24px] p-4 sm:p-5 mb-5 transition-all active:translate-x-[1px] active:translate-y-[1px]";
  const neoBadge = "px-2.5 py-0.5 rounded-full border-2 border-black text-[11px] font-black uppercase tracking-tight text-white text-center";
  const neoInput = "w-full border-[3px] border-black rounded-[16px] p-3.5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#3D8BFF]/20 text-black bg-white placeholder:text-black/30 transition-all";

  return (
    <div className="flex-1 bg-[#F4F4F5] min-h-screen pb-32">
      {/* Header */}
      <div className="pt-4 px-4 sticky top-0 bg-[#F4F4F5]/90 backdrop-blur-md z-[60] border-b-2 border-black/5">
        <div className="flex flex-col gap-4 mb-4">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-black flex items-center gap-2">
            Empire <span className="text-[#3D8BFF]">Social</span>
          </h1>
          
          <div className="grid grid-cols-4 bg-white border-[3px] border-black rounded-2xl p-1 shadow-[4px_4px_0px_#000] w-full overflow-hidden">
             <button 
              onClick={() => setViewMode("Feed")}
              className={`py-3 font-black text-[11px] uppercase rounded-xl transition-all flex items-center justify-center gap-1 ${viewMode === "Feed" ? 'bg-black text-white shadow-inner' : 'bg-white text-black hover:bg-zinc-50'}`}
             >Feed</button>
             <button 
              onClick={() => { setViewMode("Industry"); setSelectedIndustryArtist(null); }}
              className={`py-3 font-black text-[11px] uppercase rounded-xl transition-all flex items-center justify-center gap-1 ${viewMode === "Industry" ? 'bg-black text-white shadow-inner' : 'bg-white text-black hover:bg-zinc-50'}`}
             >Perfis</button>
             <button 
              onClick={() => setViewMode("News")}
              className={`py-3 font-black text-[11px] uppercase rounded-xl transition-all flex items-center justify-center gap-1 ${viewMode === "News" ? 'bg-black text-white shadow-inner' : 'bg-white text-black hover:bg-zinc-50'}`}
             >News</button>
             <button 
              onClick={() => setViewMode("Settings")}
              className={`py-3 font-black text-[11px] uppercase rounded-xl transition-all flex items-center justify-center gap-1 ${viewMode === "Settings" ? 'bg-black text-white shadow-inner' : 'bg-white text-black hover:bg-zinc-50'}`}
             >Configurações</button>
          </div>
        </div>

        {myArtists.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3 px-1 italic">Interagir como:</p>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar px-1 items-center">
               {myArtists.map(art => {
                 const isActive = activeArtist?.nome === art.nome;
                 const imgUrl = driveImg(art.foto);
                 return (
                   <button 
                    key={art.nome}
                    onClick={() => { setActiveArtist(art); setSelectedArtist(art.nome); }}
                    className={`flex flex-col items-center gap-2 transition-all shrink-0 group relative`}
                   >
                      <div className={`size-14 rounded-full border-[3px] overflow-hidden transition-all relative p-0.5 ${
                        isActive 
                          ? 'border-[#3D8BFF] shadow-[0_0_15px_rgba(61,139,255,0.4)] scale-110 z-10 bg-white' 
                          : 'border-black bg-white grayscale hover:grayscale-0'
                      }`}>
                         <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 border-[1px] border-transparent">
                           {imgUrl ? (
                             <img loading="lazy" decoding="async" 
                              src={imgUrl} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(art.nome)}&background=3D8BFF&color=fff&size=128&bold=true`;
                              }}
                             />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center font-black text-lg bg-[#3D8BFF] text-white italic">{art.nome[0]}</div>
                           )}
                         </div>
                      </div>
                      {isActive && (
                        <motion.div 
                          layoutId="activeIndicator"
                          className="absolute bottom-6 right-0 size-4 bg-[#D0FF43] border-2 border-black rounded-full flex items-center justify-center z-20"
                        >
                          <div className="size-1 bg-black rounded-full animate-pulse" />
                        </motion.div>
                      )}
                      <span className={`text-[11px] font-black uppercase italic tracking-tighter transition-all ${isActive ? 'text-[#3D8BFF] scale-105' : 'text-black/60'}`}>
                        {art.nome.split(' ')[0]}
                      </span>
                   </button>
                 );
               })}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 max-w-xl mx-auto mt-4">
        {viewMode === "Feed" ? (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4">
                 <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                 <p className="font-black italic uppercase text-black">Carregando Hype...</p>
              </div>
            ) : (
              posts.map((post) => (
                <motion.div 
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${neoCard} ${getPostStyles(post.tipo)}`}
                >
                  <div 
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedPost(post);
                      loadComments(post.id);
                      setIsCommentModalOpen(true);
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-black overflow-hidden flex-shrink-0 bg-[#FFD166] flex items-center justify-center font-black text-black">
                          {post.avatar ? (
                            <img loading="lazy" decoding="async" 
                              src={driveImg(post.avatar)} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                  target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-zinc-200 text-black text-[10px] font-black uppercase">${post.autor[0]}</div>`;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-200 text-black text-[10px] font-black uppercase">{post.autor[0]}</div>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-sm text-black leading-none">{post.autor}</p>
                          <p className="text-[10px] text-black font-black opacity-80 uppercase">{post.handle}</p>
                        </div>
                      </div>
                        <div className="flex-shrink-0">
                          {post.tipo === "Instagram" && <Instagram className="size-5 text-black" />}
                          {post.tipo === "Twitter" && <Twitter className="size-5 text-black" />}
                          {post.tipo === "TikTok" && <Video className="size-5 text-black" />}
                        </div>
                      </div>

                    {post.tipo === "Instagram" && post.subtipo === "Story" ? (
                      <div className="relative aspect-[9/16] bg-black border-2 border-black rounded-[15px] overflow-hidden mb-4 shadow-[4px_4px_0px_#000]">
                        {post.media_url ? (
                          <img loading="lazy" decoding="async" 
                            src={driveImg(post.media_url)} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://placehold.co/600x1067?text=Story";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-black italic">STORY</div>
                        )}
                        <div className="absolute top-4 left-4 flex gap-2">
                           <span className={neoBadge + " bg-[#D0FF43] text-black font-black"}>Story</span>
                        </div>
                      </div>
                    ) : post.media_url && (
                      <div className="aspect-square bg-muted border-2 border-black rounded-[15px] overflow-hidden mb-4 shadow-[4px_4px_0px_#000]">
                        <img loading="lazy" decoding="async" 
                          src={driveImg(post.media_url)} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://placehold.co/600x600?text=Post";
                          }}
                        />
                      </div>
                    )}

                    <p className="font-bold text-sm leading-snug mb-4 text-black text-pretty">
                      {post.texto}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 pt-3 border-t-2 border-current/10">
                    <button 
                      onClick={() => handleLike(post.id)}
                      className="flex items-center gap-1 font-black text-xs hover:opacity-70 transition-colors text-black"
                    >
                      <Heart className={`size-4 ${post.analytics.likes > 0 ? 'fill-[#3D8BFF] text-[#3D8BFF]' : 'text-black'}`} /> {post.analytics.likes}
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedPost(post);
                        loadComments(post.id);
                        setIsCommentModalOpen(true);
                      }}
                      className="flex items-center gap-1 font-black text-xs hover:opacity-70 transition-colors text-black"
                    >
                      <MessageCircle className="size-4 text-black" /> {post.analytics.comments}
                    </button>
                    <button className="flex items-center gap-1 font-black text-xs ml-auto text-black">
                      <Share2 className="size-4 text-black" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </>
        ) : viewMode === "News" ? (
          <div className="grid gap-6 pb-20">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-2xl font-black italic uppercase text-black tracking-tighter">Empire <span className="text-[#3D8BFF]">NEWS</span></h2>
               <button 
                onClick={() => setIsNewsModalOpen(true)}
                className="p-2 bg-black text-[#D0FF43] rounded-full border-2 border-black shadow-[3px_3px_0px_#D0FF43]"
               >
                 <Plus className="size-5 text-[#D0FF43]" />
               </button>
            </div>
            <div className="grid grid-cols-1 gap-8">
              {news.map((item) => (
                <motion.div 
                  key={item.id}
                  layoutId={item.id}
                  onClick={() => setSelectedNews(item)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white text-black border-[3.5px] border-black rounded-[35px] overflow-hidden shadow-[8px_8px_0px_#000] cursor-pointer group active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex flex-col"
                >
                  <div className="aspect-[16/9] bg-zinc-100 relative border-b-[3.5px] border-black overflow-hidden">
                    {item.imagem ? (
                      <img src={driveImg(item.imagem)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer"  loading="lazy" decoding="async"/>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#D0FF43]/10">
                         <Newspaper className="size-12 text-black/5" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                       <span className="bg-black text-[#D0FF43] text-[11px] font-black uppercase px-3 py-1 rounded-full border-2 border-white/20 shadow-lg">EXCLUSIVO</span>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6 bg-white shrink-0">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase text-black/70 mb-3 italic tracking-widest">
                       <span className="text-[#3D8BFF] tracking-tighter">{item.autor}</span>
                       <span className="size-1 rounded-full bg-black/30" />
                       <span className="opacity-80">{new Date(item.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h3 className="text-xl font-black uppercase italic leading-[1.1] mb-3 line-clamp-2 group-hover:text-[#3D8BFF] transition-colors tracking-tight text-black">{item.titulo}</h3>
                    <p className="text-[13.5px] font-bold text-[#1A1A1B] leading-snug line-clamp-3 mb-5">{item.conteudo}</p>
                    <div className="flex justify-between items-center pt-3 border-t-2 border-dashed border-black/20">
                       <span className="text-[10px] font-black uppercase opacity-50 italic">Leitura 2 min</span>
                       <span className="text-xs font-black uppercase italic text-[#3D8BFF] flex items-center gap-1 group-hover:gap-2 transition-all">Ver Matéria Completa <ChevronRight className="size-3 stroke-[3]" /></span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {news.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                <Newspaper className="size-12 opacity-10" />
                <p className="font-black uppercase italic opacity-20">Sem manchetes no momento</p>
              </div>
            )}
          </div>
        ) : viewMode === "Industry" ? (
          <div className="grid gap-6 pb-20">
            {!selectedIndustryArtist ? (
              <>
                <h2 className="text-2xl font-black italic uppercase text-black tracking-tighter text-center">Império <span className="text-[#3D8BFF]">Perfis</span></h2>
                <div className="grid gap-4">
                  {allArtists.map(art => (
                    <motion.button
                      key={art.nome}
                      whileHover={{ x: 5 }}
                      onClick={() => { setSelectedIndustryArtist(art); setIndustryViewTab(null); }}
                      className="flex items-center gap-4 p-4 bg-white border-[3px] border-black rounded-[20px] shadow-[4px_4px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all group"
                    >
                      <div className="size-14 rounded-full border-2 border-black overflow-hidden flex-shrink-0 bg-stone-100 flex items-center justify-center">
                        <UserCircle className="size-8 text-black/20" />
                      </div>
                      <div className="flex flex-col items-start text-left">
                        <span className="font-black text-lg uppercase italic text-black">{art.nome}</span>
                        <span className="text-[10px] font-bold uppercase opacity-40">{art.gravadora || "Independent"}</span>
                      </div>
                      <ChevronRight className="ml-auto size-6 text-[#3D8BFF] opacity-0 group-hover:opacity-100 transition-all" />
                    </motion.button>
                  ))}
                </div>
              </>
            ) : !industryViewTab ? (
              <div className="space-y-6">
                 {/* Selection of Networks Screen */}
                 <div className="flex flex-col items-center text-center gap-2">
                    <button 
                      onClick={() => setSelectedIndustryArtist(null)}
                      className="self-start text-[10px] font-black uppercase italic text-[#3D8BFF] mb-2 flex items-center gap-1"
                    >
                      <ChevronRight className="size-3 rotate-180" /> Voltar para Artistas
                    </button>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-black">{selectedIndustryArtist.nome}</h2>
                    <p className="text-xs font-black uppercase opacity-60 text-black px-4">{selectedIndustryArtist.descricao}</p>
                 </div>

                 <div className="grid gap-4 mt-6">
                    {["Instagram", "Twitter", "TikTok"].map((rede) => {
                      const perfil = profiles.find(p => p.artista === selectedIndustryArtist.nome && p.rede === rede);
                      return (
                        <motion.button
                          key={rede}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setIndustryViewTab(rede as any)}
                          className="p-5 bg-white border-[3px] border-black rounded-[25px] shadow-[6px_6px_0px_#000] flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`size-12 rounded-2xl flex items-center justify-center border-2 border-black ${
                              rede === "Instagram" ? "bg-[#FF4757]/10" : rede === "Twitter" ? "bg-[#3D8BFF]/10" : "bg-black/10"
                            }`}>
                              {rede === "Instagram" && <Instagram className="size-6 text-[#FF4757]" />}
                              {rede === "Twitter" && <Twitter className="size-6 text-[#3D8BFF]" />}
                              {rede === "TikTok" && <Video className="size-6 text-black" />}
                            </div>
                            <div className="text-left">
                              <h4 className="font-black text-sm uppercase italic text-black">{rede}</h4>
                              <p className="text-[10px] font-bold uppercase opacity-50">{perfil ? perfil.handle : 'Sem Perfil'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             {perfil && (
                               <span className="text-[11px] font-black uppercase bg-black text-white px-2 py-0.5 rounded-md italic">
                                 {perfil.seguidores?.toLocaleString() || 0} SEGS
                               </span>
                             )}
                             <ChevronRight className="size-5 text-black group-hover:translate-x-1 transition-transform" />
                          </div>
                        </motion.button>
                      );
                    })}
                 </div>
              </div>
            ) : (() => {
              const perfil = profiles.find(p => p.artista === selectedIndustryArtist.nome && p.rede === industryViewTab);
              const artistPosts = posts.filter(p => p.autor === selectedIndustryArtist.nome && p.tipo === industryViewTab);
              const handle = perfil?.handle || ('@' + selectedIndustryArtist.nome.toLowerCase().replace(/\s+/g, ''));
              const cleanHandle = handle.replace(/^@/, '');
              const bio = perfil?.bio || selectedIndustryArtist.descricao || '';
              const followers = perfil?.seguidores || 0;
              const following = perfil?.seguindo || 0;
              const totalLikes = artistPosts.reduce((s, p) => s + (p.analytics?.likes || 0), 0);
              
              // ✅ Correção: Busca garantida da imagem
              const profileAvatarStr = perfil?.avatar_url || perfil?.avatar || perfil?.foto;
              const avatarSrc = profileAvatarStr ? driveImg(profileAvatarStr) : undefined;
              
              const avatarFallback = (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-black text-2xl italic">
                  {selectedIndustryArtist.nome[0]}
                </div>
              );
              const renderAvatar = (className: string) => (
                <div className={className}>
                  {avatarSrc ? (
                    <img src={avatarSrc} className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : avatarFallback}
                </div>
              );

              const BackBar = ({ bg, fg, accent }: { bg: string; fg: string; accent: string }) => (
                <div className={`flex items-center justify-between px-4 py-3 ${bg} ${fg} sticky top-[152px] z-30 border-b border-current/10`}>
                  <button onClick={() => setIndustryViewTab(null)} className="flex items-center gap-1 text-sm font-bold">
                    <ChevronLeft className="size-5" /> Voltar
                  </button>
                  <p className="font-bold text-sm flex items-center gap-1">
                    {cleanHandle}
                    <BadgeCheck className={`size-4 ${accent}`} fill="currentColor" />
                  </p>
                  <MoreVertical className="size-5 opacity-70" />
                </div>
              );

              // ============ INSTAGRAM ============
              if (industryViewTab === 'Instagram') {
                return (
                  <div className="-mx-4 bg-white text-black rounded-[24px] overflow-hidden border-[3px] border-black shadow-[6px_6px_0px_#000]">
                    <BackBar bg="bg-white" fg="text-black" accent="text-[#3D8BFF]" />
                    <div className="px-5 pt-5">
                      <div className="flex items-start gap-6">
                        <div className="p-[3px] rounded-full bg-gradient-to-tr from-[#feda75] via-[#fa7e1e] via-[#d62976] via-[#962fbf] to-[#4f5bd5]">
                          <div className="p-[2px] bg-white rounded-full">
                            {renderAvatar("size-20 rounded-full overflow-hidden bg-zinc-100")}
                          </div>
                        </div>
                        <div className="flex-1 grid grid-cols-3 gap-2 text-center