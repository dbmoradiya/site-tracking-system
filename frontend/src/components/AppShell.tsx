import { AppShell as MantineAppShell, Avatar, Burger, Group, NavLink as MantineNavLink, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Bell, Building2, LayoutDashboard, KeyRound, LogOut, Settings } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { hasRole } from '../lib/api'
import { ChangePasswordModal } from './ChangePassword'
import { useState } from 'react'

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: Building2 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/setup', label: 'Setup', icon: Settings, adminOnly: true },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [pwOpen, setPwOpen] = useState(false)
  const [opened, { toggle, close }] = useDisclosure(false)
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const links = navigation.filter(item => !item.adminOnly || hasRole(user, 'ADMIN'))
  const roleLabel = user?.roles.map(role => role.toLowerCase().replaceAll('_', ' ')).join(', ') || ''
  useEffect(() => {
    close()
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname, close])
  const initials = user?.name.slice(0, 2).toUpperCase()
  return <MantineAppShell header={{ height: 48 }} navbar={{ width: 208, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding={0}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <MantineAppShell.Header>
      <Group h="100%" px="sm" justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
          <span className="brand__mark">ST</span><Text fw={700}>SiteTrack</Text>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed" visibleFrom="sm" tt="capitalize">{roleLabel}</Text>
          <Avatar size="sm" color="orange" aria-label={`${user?.name}, ${roleLabel}`}>{initials}</Avatar>
          <UnstyledButton onClick={() => setPwOpen(true)} aria-label="Change password" title="Change password" className="header-icon"><KeyRound size={18} aria-hidden="true" /></UnstyledButton>
          <UnstyledButton onClick={logout} aria-label="Sign out" className="header-icon"><LogOut size={18} aria-hidden="true" /></UnstyledButton>
        </Group>
      </Group>
    </MantineAppShell.Header>
    <ChangePasswordModal opened={pwOpen} onClose={() => setPwOpen(false)} />
    <MantineAppShell.Navbar p="xs">
      <ScrollArea>
        <Stack gap={2} component="nav" aria-label="Primary navigation">
          {links.map(({ to, label, icon: Icon }) => <MantineNavLink key={to} component={NavLink} to={to} end={to === '/'}
            label={label} leftSection={<Icon size={16} aria-hidden="true" />} onClick={close}
            active={to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)} />)}
        </Stack>
      </ScrollArea>
      <Group mt="auto" gap="xs" p="xs" wrap="nowrap" className="nav-profile">
        <Avatar size="sm" color="orange">{initials}</Avatar>
        <div><Text size="sm" fw={600} lh={1.2}>{user?.name}</Text><Text size="xs" c="dimmed" tt="capitalize">{roleLabel}</Text></div>
      </Group>
    </MantineAppShell.Navbar>
    <MantineAppShell.Main>
      <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>{children}</main>
    </MantineAppShell.Main>
  </MantineAppShell>
}
