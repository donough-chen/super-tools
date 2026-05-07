import React, { useEffect, useRef, createContext, useContext } from 'react';
import { useThemeStore } from '@/store/theme';
import { useUserStore } from '@/store/user';
import { useAnnouncement } from '@/utils/useAnnouncement';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Footer from '@/components/Footer';
import GlobalModal from '@/components/GlobalModal';
import '@/styles/global.less';
import './index.less';

// 创建 Layout 上下文，供子组件访问 mainRef
interface LayoutContextType {
  mainRef: React.RefObject<HTMLDivElement | null> | undefined;
}
export const LayoutContext = createContext<LayoutContextType>({
  mainRef: undefined,
});
export const useLayoutContext = () => useContext(LayoutContext);

interface BasicLayoutProps {
  children: React.ReactNode;
}

const BasicLayout: React.FC<BasicLayoutProps> = ({ children }) => {
  const mainRef = useRef<HTMLDivElement>(null);
  const { initTheme } = useThemeStore();
  const { init: initUser, initialized } = useUserStore();
  const { checkAnnouncements } = useAnnouncement();

  // 初始化主题
  useEffect(() => {
    initTheme();
  }, []);

  // 初始化用户状态
  useEffect(() => {
    initUser();
  }, []);

  // 用户状态初始化完成后检查公告
  useEffect(() => {
    if (initialized) {
      // 延迟 800ms，等页面渲染完成后再弹出公告
      const timer = setTimeout(() => {
        checkAnnouncements();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [initialized]);

  return (
    <LayoutContext.Provider value={{ mainRef }}>
      <div className="layout">
        {/* Header 区域 */}
        <header className="layout__header">
          <Header />
        </header>

        {/* Header 与主体分割线 */}
        <div className="layout__divider" />

        {/* 主体内容区域 */}
        <div className="layout__body">
          {/* Sidebar 侧边栏（PC端显示） */}
          <aside className="layout__sidebar">
            <Sidebar mainRef={mainRef} />
          </aside>

          {/* Main 内容区 */}
          <main className="layout__main" ref={mainRef}>
            <div className="layout__main-inner">{children}</div>
          </main>
        </div>

        {/* Footer 区域 */}
        <footer className="layout__footer">
          <Footer />
        </footer>

        {/* 全局弹窗（挂载在 Layout 层，全局可用） */}
        <GlobalModal />
      </div>
    </LayoutContext.Provider>
  );
};

export default BasicLayout;
