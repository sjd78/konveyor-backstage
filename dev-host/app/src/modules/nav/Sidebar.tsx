import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import {
  NavContentBlueprint,
  type NavContentComponentProps,
} from '@backstage/plugin-app-react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { SidebarLogo } from './SidebarLogo';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';

function AppSidebar({ navItems }: NavContentComponentProps) {
  const identityApi = useApi(identityApiRef);
  const nav = navItems.withComponent(item => (
    <SidebarItem icon={() => item.icon} to={item.href} text={item.title} />
  ));

  // Skipped items
  nav.take('page:search'); // Using search modal instead
  nav.take('page:notifications'); // Using NotificationsSidebarItem manually instead

  const handleLogout = async () => {
    try {
      sessionStorage.clear();
    } catch {
      /* noop */
    }
    try {
      await identityApi.signOut();
    } catch {
      /* noop */
    }
    window.location.href = '/';
  };

  return (
    <Sidebar>
      <SidebarLogo />
      <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
        <SidebarSearchModal />
      </SidebarGroup>
      <SidebarDivider />
      <SidebarGroup label="Menu" icon={<MenuIcon />}>
        {nav.take('page:home')}
        {nav.take('page:catalog')}
        {nav.take('page:scaffolder')}
        <SidebarDivider />
        <SidebarScrollWrapper>
          {nav.rest({ sortBy: 'title' })}
        </SidebarScrollWrapper>
      </SidebarGroup>
      <SidebarSpace />
      <SidebarDivider />
      <NotificationsSidebarItem />
      <SidebarDivider />
      <SidebarGroup
        label="Settings"
        icon={<UserSettingsSignInAvatar />}
        to="/settings"
      >
        {nav.take('page:app-visualizer')}
        {nav.take('page:user-settings')}
      </SidebarGroup>
      <SidebarDivider />
      <SidebarItem
        icon={ExitToAppIcon}
        text="Log out"
        onClick={handleLogout}
      />
    </Sidebar>
  );
}

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: AppSidebar,
  },
});
