import { FileText, Images } from 'lucide-react'
import { NavLink } from 'react-router-dom'
export default function ContentNavigation() {
 return <nav className="content-navigation" aria-label="Website content"><NavLink to="/admin/pages"><FileText aria-hidden="true"/>Pages</NavLink><NavLink to="/admin/banners"><Images aria-hidden="true"/>Banners</NavLink></nav>
}
