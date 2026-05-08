import config from './config';
import customRequest, { noVerifyRequest } from './request';
import utils from './utils';
import { report } from './report';
import openPages from './openPages';

export { config, customRequest as request, noVerifyRequest, utils, report, openPages };
export {
  navigate,
  navigateTo,
  navigateBack,
  navigateReplace,
  openUrl,
  getCurrentPathname,
  getCurrentLocation,
} from './navigator';
export type { NavigateType, NavigateOptions } from './navigator';

export default { config, request: customRequest, noVerifyRequest, utils, report, openPages };
