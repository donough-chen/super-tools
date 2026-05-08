/**
 * 会员服务页 Member
 *
 * 二级页面：会员套餐展示与订阅
 */
import React, { useEffect, useState } from 'react';
import { navigateBack } from '@/utils/navigator';
import { getMemberInfo } from '../../service';
import AppHeader from '../../components/AppHeader';
import './index.less';

interface MemberPlan {
  id: string;
  name: string;
  price: number;
  duration: number;
  description: string;
}

const MemberPage: React.FC = () => {
  const [plans, setPlans] = useState<MemberPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  useEffect(() => {
    getMemberInfo().then(res => {
      const data = (res?.code === 200) ? res.data : null;
      if (data?.plans) {
        setPlans(data.plans);
        setSelectedPlan(data.plans[0]?.id || '');
      }
    });
  }, []);

  return (
    <div className="page-member">
      <AppHeader title="会员" showBack onBack={() => navigateBack()} />
      <main className="page-member__content">
        <div className="page-member__plans">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`page-member__plan ${selectedPlan === plan.id ? 'page-member__plan--active' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <h3 className="page-member__plan-name">{plan.name}</h3>
              <div className="page-member__plan-price">¥{plan.price}</div>
              <p className="page-member__plan-desc">{plan.description}</p>
            </div>
          ))}
        </div>
        <button className="page-member__subscribe">立即订阅</button>
      </main>
    </div>
  );
};

export default MemberPage;
