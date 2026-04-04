# Project Structure

```
app/
├── public/                          # Static files
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                # Auth route group
│   │   │   ├── login/
│   │   │   │   └── page.tsx       # Login page
│   │   │   ├── register/
│   │   │   │   └── page.tsx       # Register page
│   │   │   └── layout.tsx         # Auth layout
│   │   │
│   │   ├── (teacher)/             # Teacher route group
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx       # Teacher dashboard
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx       # Analytics page
│   │   │   └── layout.tsx         # Teacher layout with navbar
│   │   │
│   │   ├── (student)/             # Student route group
│   │   │   ├── chat/
│   │   │   │   └── page.tsx       # Student chat interface
│   │   │   └── layout.tsx         # Student layout with navbar
│   │   │
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Home page (redirects)
│   │   └── globals.css            # Global styles
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── navbar.tsx         # Main navigation
│   │   │   ├── user-nav.tsx       # User dropdown menu
│   │   │   ├── theme-toggle.tsx   # Dark/Light toggle
│   │   │   └── protected-route.tsx # Route protection HOC
│   │   │
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── form.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sonner.tsx
│   │   │   └── scroll-area.tsx
│   │   │
│   │   └── theme-provider.tsx     # Theme context provider
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── login-form.tsx     # Login form component
│   │   │   └── register-form.tsx  # Registration form component
│   │   │
│   │   ├── courses/
│   │   │   ├── create-course-dialog.tsx  # Create course modal
│   │   │   ├── course-card.tsx           # Course card component
│   │   │   ├── document-upload.tsx       # Drag-drop upload
│   │   │   └── document-list.tsx         # Document table
│   │   │
│   │   └── chat/
│   │       └── course-select.tsx  # Course selector dropdown
│   │
│   ├── lib/
│   │   ├── api.ts                 # API endpoint functions
│   │   ├── api-client.ts          # Axios instance with auth
│   │   ├── constants.ts           # App-wide constants
│   │   └── utils.ts               # Utility functions
│   │
│   ├── store/
│   │   ├── auth-store.ts          # Auth state (Zustand)
│   │   └── course-store.ts        # Course state (Zustand)
│   │
│   └── types/
│       └── index.ts               # TypeScript type definitions
│
├── .env.local                     # Environment variables (local)
├── .gitignore
├── next.config.ts                 # Next.js configuration
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.ts             # Tailwind configuration
├── postcss.config.mjs             # PostCSS configuration
│
├── README.md                      # Project documentation
├── SETUP.md                       # Setup instructions
├── START_HERE.md                  # Quick start guide
└── INSTALL_DEPS.md                # Dependency installation
```

## Key Directories Explained

### `app/` Routes
- **(auth)/** - Grouped routes for authentication (no URL prefix)
- **(teacher)/** - Teacher-only routes (protected)
- **(student)/** - Student-only routes (protected)

### `components/`
- **layout/** - Reusable layout components
- **ui/** - shadcn/ui component library

### `features/`
- Feature-based organization
- Each feature has its own components
- Easier to maintain and scale

### `lib/`
- Shared utilities and configurations
- API client and functions
- Helper functions

### `store/`
- Zustand state management
- Global state stores

### `types/`
- TypeScript type definitions
- Shared across the app

## Route Protection

Routes are protected using the `ProtectedRoute` component:

```tsx
// Teacher routes require 'teacher' role
<ProtectedRoute allowedRoles={['teacher']}>
  {children}
</ProtectedRoute>

// Student routes require 'student' role
<ProtectedRoute allowedRoles={['student']}>
  {children}
</ProtectedRoute>
```

## State Management

### Auth Store (Global)
```tsx
const { user, token, isAuthenticated, setAuth, clearAuth } = useAuthStore();
```

### Course Store (Global)
```tsx
const { selectedCourse, courses, setSelectedCourse, setCourses } = useCourseStore();
```

## API Integration

All API calls go through `lib/api.ts`:

```tsx
import { authApi, courseApi, documentApi, chatApi } from '@/lib/api';

// Example
const response = await courseApi.getAll();
```

## Styling

- **Tailwind CSS** for utility classes
- **CSS Variables** for theming
- **Dark/Light mode** support
- **Responsive** breakpoints (sm, md, lg, xl)

## Best Practices

1. **Components:** Keep components small and focused
2. **Types:** Always use TypeScript types
3. **State:** Use Zustand for global state, local state for component-specific
4. **API:** All API calls in `lib/api.ts`
5. **Error Handling:** Use try/catch with toast notifications
6. **Loading States:** Always show loading indicators
