const path = require('path');

module.exports = {
  prompts() {
    return [
      {
        name: 'parent',
        message: '请选择项目分类',
        type: 'list',
        choices: [
          { name: 'h5  - H5 移动端页面', value: 'h5' },
          { name: 'pc  - PC 端页面', value: 'pc' },
          { name: 'other - 其他小需求', value: 'other' },
        ],
      },
      {
        name: 'projectName',
        message: '请输入项目名称（字母、中划线，如: my-project）',
      },
      {
        name: 'designWidth',
        message: '请选择设计稿宽度',
        type: 'list',
        choices: [
          { name: '750px（推荐，rootValue: 20）', value: '750' },
          { name: '375px（rootValue: 10）', value: '375' },
        ],
        default: '750',
      },
      {
        name: 'openPage',
        message: '是否允许端外（非 App）打开？',
        type: 'confirm',
        default: false,
      },
    ];
  },
  templateDir: path.join(process.cwd(), 'packages/template'),
  actions() {
    const { parent, projectName } = this.answers;
    this.sao.opts.outDir = path.join(process.cwd(), 'packages', parent, projectName);
    return [
      {
        type: 'add',
        files: '**',
      },
      {
        // 将 package.json 中的模板名称替换为真实项目名
        type: 'modify',
        files: 'package.json',
        handler(data) {
          data.name = `${parent}-${projectName}`;
          return data;
        },
      },
    ];
  },
  async completed() {
    const { parent, projectName } = this.answers;
    console.log('');
    console.log('✅ 项目创建成功！');
    console.log('');
    console.log('启动开发服务器：');
    console.log(`  $ yarn start ${parent}/${projectName}`);
    console.log('');
    console.log('构建生产包：');
    console.log(`  $ yarn build-prod ${parent}/${projectName}`);
    console.log('');
  },
};
