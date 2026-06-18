import {
  ShoppingBag, Images, Lightbulb, ReceiptText, Users, CalendarDays, Tag, Tags,
  NotebookPen, Settings, LogOut, Crown, Store, MessageCircle, Search, Trash2,
  Pencil, Share2, Upload, Link2, MapPin, X, Check, ChevronRight, ChevronLeft,
  Lock, Camera, Image as ImageIcon, Plus, Star, Eye, RotateCw, AlertCircle,
  Sparkle, ArrowLeft, ArrowRight, ArrowDownToLine, Hand, Square, RotateCcw,
  Crop, type LucideProps,
} from 'lucide-react'

/**
 * Conjunto único de ícones de LINHA (Decisão #9). Tudo via currentColor — a cor
 * vem do contexto (e portanto do tema). Mapa semântico para manter coesão e
 * trocar o pictograma num lugar só. Substitui os emojis em todas as telas.
 */
const MAPA = {
  vitrine: ShoppingBag,
  trabalhos: Images,
  inspiracoes: Lightbulb,
  pedidos: ReceiptText,
  clientes: Users,
  calendario: CalendarDays,
  precos: Tag,
  tags: Tags,
  anotacoes: NotebookPen,
  config: Settings,
  sair: LogOut,
  plano: Crown,
  loja: Store,
  whatsapp: MessageCircle,
  busca: Search,
  lixo: Trash2,
  editar: Pencil,
  compartilhar: Share2,
  enviar: Upload,
  link: Link2,
  local: MapPin,
  fechar: X,
  ok: Check,
  avancar: ChevronRight,
  voltar: ChevronLeft,
  cadeado: Lock,
  camera: Camera,
  imagem: ImageIcon,
  mais: Plus,
  estrela: Star,
  olho: Eye,
  recarregar: RotateCw,
  alerta: AlertCircle,
  brilho: Sparkle,
  setaEsq: ArrowLeft,
  seta: ArrowRight,
  baixar: ArrowDownToLine,
  ola: Hand,
  quadrado: Square,
  girar: RotateCcw,
  cortar: Crop,
} as const

export type NomeIcone = keyof typeof MAPA

type Props = { nome: NomeIcone } & LucideProps

export function Icone({ nome, size = 20, strokeWidth = 1.75, ...rest }: Props) {
  const C = MAPA[nome]
  return <C size={size} strokeWidth={strokeWidth} aria-hidden {...rest} />
}
