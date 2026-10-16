import {fileURLToPath} from 'node:url';
export default {
 root:fileURLToPath(new URL('../../../',import.meta.url)),
 test:{environment:'jsdom',setupFiles:['./test/setup.js'],include:['src/pages/Home/Home.test.jsx']}
};
