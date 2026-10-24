import { LayoutDashboard, Package, Shapes, ShoppingBag, UsersRound, Images, FileText, Star, ChartNoAxesCombined, Settings2, CircleDollarSign, Clock3, Repeat2, Sparkles, Check, type LucideIcon } from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, products: Package, categories: Shapes, orders: ShoppingBag,
  customers: UsersRound, banners: Images, pages: FileText, reviews: Star,
  analytics: ChartNoAxesCombined, settings: Settings2, revenue: CircleDollarSign,
  clock: Clock3, repeat: Repeat2, new: Sparkles, rating: Star, check: Check,
}
export default function AdminIcon({ name }: { name: string }) {
  const Icon = icons[name] ?? Package
  return <Icon className="admin-icon" size={20} strokeWidth={1.65} aria-hidden="true" />
}
