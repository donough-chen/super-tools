const notificationRoutes = [
  {
    path: '/notification',
    routes: [
      { path: '/notification', redirect: '/notification/types' },
      {
        path: '/notification/types',
        component: '@/pages/Notification/Types',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/notification/templates',
        component: '@/pages/Notification/Templates',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/notification/tasks',
        component: '@/pages/Notification/Tasks',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/notification/messages',
        component: '@/pages/Notification/Messages',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/notification/rate-limits',
        component: '@/pages/Notification/RateLimits',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/notification/channels',
        component: '@/pages/Notification/Channels',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default notificationRoutes;
