import React from 'react';
import { Card, Typography, Row, Col, List, Empty, Tag } from 'antd';
import * as Icons from '@ant-design/icons';
import { useSelector, history } from 'umi';
import type { GlobalModelState } from '@/models/global';
import { findFirstLeaf } from '@/utils/permission';

const { Title, Paragraph } = Typography;

/** 业务模块描述（用于首页卡片介绍） */
const MODULE_DESC: Record<string, string> = {
  dashboard: '查看核心运营指标与趋势',
  system: '角色、权限、审计日志、权限测试',
  user: '管理用户、状态与角色绑定',
  category: '维护工具分类与排序',
  tool: '工具上架、下架、批量编辑',
  feedback: '用户反馈处理与回复',
  stats: '使用情况、活跃度、导出',
  member: '会员等级、套餐、积分',
};

/** 系统公告（Spec-C 将接通真实公告接口） */
const ANNOUNCEMENTS = [
  { id: 1, title: '【更新】RBAC 体系上线，菜单按权限动态加载', date: '2026-05-11' },
  { id: 2, title: '【提示】如未看到预期菜单，请联系管理员或点击头像「刷新菜单」', date: '2026-05-11' },
];

/**
 * Home — 登录后软着陆首页
 * - 任何登录用户均可访问（不挂 AuthWrapper）
 * - 展示：公告 / 业务模块卡片（按用户权限过滤）/ 快捷入口
 */
const Home: React.FC = () => {
  const { menus } = useSelector((state: { global: GlobalModelState }) => state.global);

  const handleEnterModule = (m: MenuNode) => {
    const leaf = findFirstLeaf([m]);
    if (leaf) history.push(leaf.path);
    else history.push(m.path);
  };

  return (
    <div>
      <Title level={3}>欢迎使用 Super Tools 管理端</Title>
      <Paragraph type="secondary">
        左侧菜单按你的角色权限动态加载；如未看到预期菜单项，请联系管理员。
      </Paragraph>

      <Card title="系统公告" style={{ marginTop: 16 }}>
        {ANNOUNCEMENTS.length > 0 ? (
          <List
            dataSource={ANNOUNCEMENTS}
            renderItem={(a) => (
              <List.Item>
                <List.Item.Meta title={a.title} description={a.date} />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无公告" />
        )}
      </Card>

      <Card title="业务模块" style={{ marginTop: 16 }}>
        {menus.length > 0 ? (
          <Row gutter={[16, 16]}>
            {menus.map((m) => {
              const IconComp: any = m.icon ? (Icons as any)[m.icon] : null;
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={m.code}>
                  <Card hoverable size="small" onClick={() => handleEnterModule(m)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {IconComp ? <IconComp style={{ fontSize: 18 }} /> : null}
                      <Tag color="blue">{m.module}</Tag>
                      <strong>{m.name}</strong>
                    </div>
                    <Paragraph
                      type="secondary"
                      style={{ marginTop: 8, marginBottom: 0 }}
                    >
                      {MODULE_DESC[m.module] || ''}
                    </Paragraph>
                  </Card>
                </Col>
              );
            })}
          </Row>
        ) : (
          <Empty description="您当前没有任何业务模块权限，请联系管理员" />
        )}
      </Card>

      <Card title="快捷入口" style={{ marginTop: 16 }}>
        <Empty description="即将到来 — 由 Spec-C 接通最近访问 / 收藏页面" />
      </Card>
    </div>
  );
};

export default Home;
