import {AC, FasterAC} from './AC.js';
import {NotEnoughDataError} from '../error/index.js';
import {HighLowNumber} from '../util/index.js';

describe('AC', () => {
  describe('getResult', () => {
    it('works with a signal line of SMA(5)', () => {
      const ac = new AC(5, 34, 5);
      const fasterAC = new FasterAC(5, 34, 5);

      // Test data verified with:
      // https://github.com/jesse-ai/jesse/blob/8e502d070c24bed29db80e1d0938781d8cdb1046/tests/data/test_candles_indicators.py#L4351
      const candles = [
        [1563408000000, 210.8, 225.73, 229.65, 205.71, 609081.49094],
        [1563494400000, 225.75, 220.73, 226.23, 212.52, 371622.21865],
        [1563580800000, 220.84, 228.2, 235.09, 219.78, 325393.97225],
        [1563667200000, 228.25, 225.38, 229.66, 216.99, 270046.1519],
        [1563753600000, 225.49, 217.51, 228.34, 212.25, 271310.40446],
        [1563840000000, 217.59, 212.48, 219.55, 208.36, 317876.48242],
        [1563926400000, 212.55, 216.31, 218.28, 202.0, 331162.6484],
        [1564012800000, 216.31, 219.14, 225.12, 215.23, 280370.29627],
        [1564099200000, 219.14, 218.81, 220.0, 212.71, 197781.98653],
        [1564185600000, 218.81, 207.3, 223.3, 203.0, 301209.41113],
        [1564272000000, 207.3, 211.62, 213.52, 198.24, 218801.16693],
        [1564358400000, 211.58, 210.89, 215.83, 206.59, 226941.28],
        [1564444800000, 210.84, 209.58, 214.36, 204.4, 222683.79393],
        [1564531200000, 209.57, 218.42, 218.79, 209.2, 207213.55658],
        [1564617600000, 218.42, 216.84, 219.39, 210.54, 186806.18844],
        [1564704000000, 216.8, 217.61, 222.18, 214.31, 206867.03039],
        [1564790400000, 217.69, 222.14, 224.51, 216.62, 181591.95296],
        [1564876800000, 222.14, 221.79, 223.34, 216.9, 135622.0258],
        [1564963200000, 221.79, 233.54, 236.25, 221.79, 307956.27211],
        [1565049600000, 233.53, 226.28, 239.15, 223.03, 341279.08159],
        [1565136000000, 226.31, 226.1, 231.25, 220.95, 279104.7037],
        [1565222400000, 226.11, 221.39, 228.5, 215.51, 236886.35423],
        [1565308800000, 221.38, 210.53, 221.79, 207.3, 232062.12757],
        [1565395200000, 210.52, 206.48, 215.0, 202.6, 252614.02389],
        [1565481600000, 206.48, 216.42, 216.94, 206.14, 188474.09048],
        [1565568000000, 216.41, 211.41, 216.81, 209.75, 122760.94619],
        [1565654400000, 211.58, 209.3, 214.3, 204.0, 166922.48201],
        [1565740800000, 209.31, 187.1, 209.9, 183.49, 325228.98931],
        [1565827200000, 187.08, 188.03, 189.95, 181.23, 237953.09426],
        [1565913600000, 187.98, 184.88, 188.39, 178.04, 282177.01584],
        [1566000000000, 184.83, 185.59, 187.0, 181.83, 138799.61508],
        [1566086400000, 185.67, 194.33, 197.91, 183.35, 175363.5062],
        [1566172800000, 194.32, 202.28, 203.59, 192.7, 239541.5978],
        [1566259200000, 202.24, 196.6, 202.75, 194.45, 189297.75494],
        [1566345600000, 196.55, 187.45, 197.2, 179.53, 284973.64194],
        [1566432000000, 187.45, 190.35, 195.14, 182.8, 245575.98772],
        [1566518400000, 190.36, 194.02, 196.19, 188.16, 192548.51552],
        [1566604800000, 194.02, 190.6, 194.09, 185.63, 167806.34294],
        [1566691200000, 190.6, 186.54, 192.4, 182.8, 169862.91522],
        [1566777600000, 186.54, 188.67, 193.7, 186.0, 254397.79472],
        [1566864000000, 188.61, 187.24, 189.49, 184.75, 157898.563],
        [1566950400000, 187.3, 173.03, 188.25, 166.48, 334480.61761],
        [1567036800000, 173.03, 169.01, 173.5, 163.61, 295241.216],
        [1567123200000, 169.03, 168.5, 170.77, 165.55, 238616.68868],
        [1567209600000, 168.48, 171.57, 174.98, 165.63, 194999.19583],
        [1567296000000, 171.52, 170.74, 173.42, 167.61, 191140.52368],
        [1567382400000, 170.73, 178.05, 181.0, 170.02, 294627.31247],
        [1567468800000, 178.0, 178.75, 183.0, 174.09, 327857.85447],
        [1567555200000, 178.79, 174.72, 180.14, 173.0, 286226.25171],
        [1567641600000, 174.7, 173.75, 176.19, 168.1, 232753.83596],
        [1567728000000, 173.74, 169.08, 177.87, 165.0, 315822.37984],
        [1567814400000, 169.11, 177.62, 180.8, 168.3, 253831.23169],
        [1567900800000, 177.58, 181.19, 184.18, 176.13, 290083.47501],
        [1567987200000, 181.18, 180.54, 185.38, 176.01, 273729.94868],
        [1568073600000, 180.52, 179.81, 184.36, 177.0, 238387.50999],
        [1568160000000, 179.87, 178.28, 182.8, 173.0, 278555.46708],
        [1568246400000, 178.3, 180.72, 182.38, 176.62, 203543.13663],
        [1568332800000, 180.71, 180.95, 181.38, 177.54, 264422.54059],
        [1568419200000, 180.96, 188.13, 188.79, 179.75, 279371.83423],
        [1568505600000, 188.14, 189.03, 190.45, 185.76, 288928.60827],
        [1568592000000, 189.05, 197.22, 199.44, 188.3, 551006.81686],
        [1568678400000, 197.23, 207.84, 215.13, 195.74, 715863.2262],
        [1568764800000, 207.85, 210.21, 217.27, 207.66, 539028.51013],
        [1568851200000, 210.27, 220.24, 223.94, 202.3, 844358.82155],
        [1568937600000, 220.26, 218.03, 221.54, 212.05, 437804.12669],
        [1569024000000, 218.01, 215.05, 221.5, 213.2, 417891.5242],
        [1569110400000, 215.04, 211.2, 215.61, 206.1, 445388.94787],
        [1569196800000, 211.2, 201.29, 211.68, 198.65, 392437.07084],
        [1569283200000, 201.25, 165.81, 202.98, 150.03, 1478218.82714],
        [1569369600000, 165.72, 169.96, 174.85, 161.88, 879001.46213],
        [1569456000000, 169.96, 165.92, 171.01, 152.11, 779942.17148],
        [1569542400000, 165.92, 173.79, 176.72, 161.03, 634932.96707],
        [1569628800000, 173.83, 173.49, 175.49, 168.0, 521775.46593],
        [1569715200000, 173.5, 169.24, 174.5, 164.12, 410855.12176],
        [1569801600000, 169.26, 180.85, 181.24, 165.01, 580295.3997],
        [1569888000000, 180.89, 175.66, 185.53, 173.19, 609819.60828],
        [1569974400000, 175.65, 180.24, 181.29, 173.65, 348268.1162],
        [1570060800000, 180.24, 174.69, 180.72, 169.55, 354756.78478],
        [1570147200000, 174.71, 175.55, 178.98, 170.74, 333897.63876],
        [1570233600000, 175.55, 176.25, 176.71, 172.02, 278488.61771],
        [1570320000000, 176.23, 170.1, 177.04, 167.68, 314932.39629],
        [1570406400000, 170.08, 179.85, 182.32, 168.68, 496523.48038],
        [1570492800000, 179.88, 180.6, 184.87, 177.0, 400832.37828],
        [1570579200000, 180.61, 192.62, 195.53, 178.96, 562506.82189],
        [1570665600000, 192.61, 191.14, 194.2, 186.88, 436588.58452],
        [1570752000000, 191.18, 180.72, 196.65, 179.41, 621693.63125],
        [1570838400000, 180.65, 179.68, 184.64, 177.59, 290415.22038],
        [1570924800000, 179.65, 180.99, 184.95, 178.52, 247589.23231],
        [1571011200000, 180.98, 186.72, 187.54, 180.43, 279732.84612],
        [1571097600000, 186.7, 180.49, 188.37, 175.96, 405466.38109],
        [1571184000000, 180.52, 174.47, 181.44, 171.81, 347764.93459],
        [1571270400000, 174.52, 177.16, 178.96, 172.61, 298795.8198],
        [1571356800000, 177.17, 172.74, 177.44, 168.66, 319602.48508],
        [1571443200000, 172.78, 171.79, 174.98, 169.44, 296918.73026],
        [1571529600000, 171.84, 175.22, 176.88, 169.21, 299141.07152],
        [1571616000000, 175.18, 173.98, 177.9, 171.59, 270608.51385],
        [1571702400000, 174.0, 171.2, 175.04, 170.3, 255429.41624],
        [1571788800000, 171.19, 162.35, 171.49, 153.45, 746955.09806],
        [1571875200000, 162.35, 160.38, 163.72, 158.72, 387310.83766],
        [1571961600000, 160.39, 181.5, 187.78, 160.25, 904832.86059],
        [1572048000000, 181.53, 179.49, 197.74, 173.8, 1211737.43684],
        [1572134400000, 179.42, 183.75, 188.7, 176.22, 724423.40525],
        [1572220800000, 183.84, 181.72, 189.48, 180.35, 582179.44545],
        [1572307200000, 181.67, 190.46, 192.74, 181.26, 529964.5054],
        [1572393600000, 190.45, 183.13, 191.71, 179.28, 537770.43056],
        [1572480000000, 183.14, 182.18, 185.27, 177.66, 410969.86104],
        [1572566400000, 182.19, 182.85, 184.5, 177.02, 331519.76963],
        [1572652800000, 182.86, 182.91, 186.0, 181.53, 179864.39739],
        [1572739200000, 182.9, 181.54, 184.7, 178.95, 232621.52147],
        [1572825600000, 181.53, 185.71, 188.64, 180.36, 321175.29134],
        [1572912000000, 185.71, 188.68, 192.51, 182.22, 389668.6472],
        [1572998400000, 188.65, 191.16, 195.09, 187.72, 343219.9224],
        [1573084800000, 191.16, 186.68, 192.27, 184.59, 309882.08206],
        [1573171200000, 186.67, 183.74, 188.26, 181.41, 365029.75027],
        [1573257600000, 183.71, 184.89, 185.79, 182.63, 192073.38044],
        [1573344000000, 184.86, 188.96, 191.58, 183.3, 274940.53448],
        [1573430400000, 188.96, 184.98, 190.19, 184.06, 255579.93429],
        [1573516800000, 184.98, 187.09, 187.65, 182.41, 256782.63119],
        [1573603200000, 187.09, 188.11, 189.66, 185.3, 197273.84001],
        [1573689600000, 188.07, 184.92, 188.72, 183.34, 245505.29971],
        [1573776000000, 184.93, 180.0, 186.7, 177.67, 407466.78964],
        [1573862400000, 179.99, 182.37, 183.46, 179.3, 172801.52576],
        [1573948800000, 182.37, 183.82, 186.09, 180.0, 198892.4372],
        [1574035200000, 183.82, 178.2, 184.06, 175.01, 293551.23632],
        [1574121600000, 178.2, 175.94, 178.52, 172.65, 275886.6411],
        [1574208000000, 175.93, 174.72, 177.41, 173.5, 216315.93309],
        [1574294400000, 174.75, 161.01, 175.85, 157.26, 473895.92992],
        [1574380800000, 161.02, 149.56, 162.79, 138.0, 977977.23794],
        [1574467200000, 149.55, 151.84, 154.33, 146.11, 369721.0996],
        [1574553600000, 151.84, 139.96, 152.86, 138.62, 352319.21558],
        [1574640000000, 139.99, 145.69, 151.5, 131.45, 749675.41303],
        [1574726400000, 145.81, 147.47, 149.97, 143.37, 354023.04298],
        [1574812800000, 147.47, 152.62, 155.54, 140.84, 564796.4284],
        [1574899200000, 152.61, 150.72, 154.63, 149.09, 317714.56326],
        [1574985600000, 150.69, 154.57, 157.6, 150.23, 328712.25558],
        [1575072000000, 154.54, 151.37, 155.25, 149.7, 226863.41299],
        [1575158400000, 151.43, 150.73, 152.49, 145.79, 344178.14088],
        [1575244800000, 150.72, 148.65, 151.42, 146.71, 233839.0973],
        [1575331200000, 148.66, 147.17, 149.93, 145.77, 196329.22503],
        [1575417600000, 147.19, 145.38, 151.98, 143.15, 434430.62379],
        [1575504000000, 145.45, 148.1, 149.02, 143.64, 299073.53972],
        [1575590400000, 148.11, 148.45, 149.77, 145.74, 220674.68581],
        [1575676800000, 148.46, 147.14, 149.49, 146.85, 140471.68588],
        [1575763200000, 147.16, 150.44, 151.62, 146.11, 205301.6026],
        [1575849600000, 150.44, 147.38, 151.19, 146.56, 243775.99249],
        [1575936000000, 147.4, 145.56, 148.57, 143.81, 203215.84937],
        [1576022400000, 145.53, 143.39, 146.34, 142.12, 157843.10484],
        [1576108800000, 143.41, 144.87, 145.85, 139.24, 261615.30437],
        [1576195200000, 144.87, 144.8, 146.0, 142.8, 160695.18556],
        [1576281600000, 144.8, 141.79, 145.07, 141.18, 126232.59201],
        [1576368000000, 141.79, 142.46, 144.12, 139.92, 151189.65877],
        [1576454400000, 142.46, 132.73, 142.72, 127.93, 471018.85942],
        [1576540800000, 132.72, 121.88, 132.98, 119.11, 563257.36001],
        [1576627200000, 121.88, 132.78, 134.87, 116.26, 884960.91334],
        [1576713600000, 132.8, 128.1, 134.0, 125.69, 420674.8172],
        [1576800000000, 128.1, 128.19, 129.39, 125.84, 213897.4673],
        [1576886400000, 128.19, 126.99, 128.4, 126.5, 135196.11641],
        [1576972800000, 127.0, 132.09, 133.07, 126.82, 253140.72413],
        [1577059200000, 132.12, 127.8, 135.1, 126.0, 421600.75655],
        [1577145600000, 127.8, 127.75, 129.69, 126.61, 200637.10098],
        [1577232000000, 127.7, 125.09, 127.84, 123.07, 225004.4909],
        [1577318400000, 125.09, 125.58, 132.26, 124.32, 274986.52097],
        [1577404800000, 125.58, 126.29, 127.1, 121.91, 240012.37451],
        [1577491200000, 126.28, 128.11, 129.68, 125.84, 196893.52277],
        [1577577600000, 128.11, 134.36, 138.07, 127.52, 316347.26666],
        [1577664000000, 134.36, 131.59, 136.24, 130.3, 320347.21956],
        [1577750400000, 131.61, 129.16, 133.68, 128.17, 264933.98418],
        [1577836800000, 129.16, 130.77, 133.05, 128.68, 144770.52197],
        [1577923200000, 130.72, 127.19, 130.78, 126.38, 213757.05806],
        [1578009600000, 127.19, 134.35, 135.14, 125.88, 413055.18895],
        [1578096000000, 134.37, 134.2, 135.85, 132.5, 184276.17102],
        [1578182400000, 134.2, 135.37, 138.19, 134.19, 254120.45343],
        [1578268800000, 135.37, 144.15, 144.41, 134.86, 408020.27375],
        [1578355200000, 144.14, 142.8, 145.31, 138.76, 447762.17281],
        [1578441600000, 142.8, 140.72, 147.77, 137.03, 570465.57764],
        [1578528000000, 140.76, 137.74, 141.5, 135.3, 366076.06569],
        [1578614400000, 137.73, 144.84, 145.17, 135.32, 409403.59507],
        [1578700800000, 144.83, 142.38, 148.05, 142.09, 368350.57939],
        [1578787200000, 142.4, 146.54, 146.6, 141.76, 229541.86137],
        [1578873600000, 146.56, 143.58, 147.0, 142.27, 207996.61865],
        [1578960000000, 143.58, 165.64, 171.7, 143.51, 1108476.31186],
        [1579046400000, 165.6, 166.4, 171.98, 159.2, 721687.80381],
        [1579132800000, 166.4, 164.21, 167.4, 157.8, 456170.86719],
        [1579219200000, 164.24, 169.85, 174.81, 162.14, 767180.67853],
        [1579305600000, 169.92, 174.14, 179.5, 164.92, 688783.17982],
        [1579392000000, 174.1, 166.79, 178.05, 161.66, 624681.28604],
        [1579478400000, 166.79, 166.87, 169.33, 161.24, 358092.8841],
        [1579564800000, 166.86, 169.49, 170.32, 164.8, 308007.6353],
        [1579651200000, 169.48, 168.07, 171.47, 166.03, 272240.90286],
        [1579737600000, 168.07, 162.81, 168.2, 159.21, 373414.34985],
        [1579824000000, 162.85, 162.54, 164.45, 155.55, 430013.19902],
        [1579910400000, 162.51, 160.35, 162.79, 157.61, 219921.65197],
        [1579996800000, 160.36, 167.86, 168.08, 159.41, 251582.55758],
        [1580083200000, 167.91, 170.08, 172.56, 165.22, 365894.81917],
        [1580169600000, 170.04, 175.64, 176.2, 170.03, 473433.89609],
        [1580256000000, 175.58, 173.72, 178.45, 173.33, 317382.90161],
        [1580342400000, 173.68, 184.69, 187.0, 170.93, 477721.6609],
        [1580428800000, 184.71, 179.99, 185.82, 175.22, 385596.53365],
        [1580515200000, 179.94, 183.6, 184.28, 179.23, 259370.12902],
        [1580601600000, 183.63, 188.44, 193.43, 179.1, 552621.13619],
        [1580688000000, 188.48, 189.69, 195.19, 186.62, 417175.95781],
        [1580774400000, 189.74, 188.91, 191.6, 184.69, 366389.69686],
        [1580860800000, 188.91, 203.78, 207.61, 188.19, 550942.11417],
        [1580947200000, 203.78, 213.19, 216.33, 201.02, 608240.2233],
        [1581033600000, 213.16, 223.33, 225.0, 213.14, 629361.15466],
        [1581120000000, 223.36, 223.05, 227.75, 213.22, 548551.87465],
        [1581206400000, 223.01, 228.49, 230.65, 222.86, 350336.24399],
        [1581292800000, 228.53, 222.89, 229.4, 216.37, 510415.49949],
        [1581379200000, 222.89, 236.69, 239.15, 218.17, 595576.90276],
        [1581465600000, 236.69, 265.74, 275.34, 236.69, 1038073.74782],
        [1581552000000, 265.74, 268.32, 277.69, 256.08, 1089679.1537],
        [1581638400000, 268.34, 285.15, 287.15, 260.28, 734944.32266],
        [1581724800000, 285.11, 264.88, 288.41, 261.86, 860813.14274],
        [1581811200000, 264.91, 258.85, 274.0, 237.41, 1110118.46395],
        [1581897600000, 258.89, 267.85, 268.77, 242.0, 1110371.39094],
        [1581984000000, 267.9, 282.61, 285.88, 258.0, 1115523.43992],
        [1582070400000, 282.64, 258.45, 285.0, 251.56, 705973.72988],
        [1582156800000, 258.44, 256.96, 264.33, 245.34, 972969.71691],
        [1582243200000, 256.97, 265.27, 268.24, 253.61, 525827.8734],
        [1582329600000, 265.32, 261.57, 266.81, 256.0, 313062.52133],
        [1582416000000, 261.55, 274.48, 275.68, 261.02, 444740.82883],
        [1582502400000, 274.5, 265.52, 277.2, 257.09, 696591.72983],
        [1582588800000, 265.47, 246.67, 266.22, 244.44, 774791.01027],
        [1582675200000, 246.67, 223.93, 250.32, 215.66, 1395879.41507],
        [1582761600000, 223.98, 227.79, 238.3, 210.0, 1273793.11658],
        [1582848000000, 227.73, 226.76, 234.67, 214.01, 1054994.92397],
        [1582934400000, 226.76, 217.21, 233.0, 217.0, 546866.6851],
        [1583020800000, 217.29, 217.81, 227.89, 212.36, 715016.01941],
        [1583107200000, 217.81, 231.97, 234.4, 216.07, 810051.4833],
        [1583193600000, 232.1, 223.91, 232.46, 219.57, 741498.54825],
        [1583280000000, 223.84, 224.26, 228.85, 220.23, 443780.33772],
        [1583366400000, 224.26, 228.38, 234.09, 224.23, 601479.87587],
        [1583452800000, 228.38, 244.88, 245.16, 227.33, 628147.3257],
        [1583539200000, 244.93, 237.23, 251.93, 236.0, 633748.89662],
        [1583625600000, 237.23, 199.43, 237.23, 195.5, 1278973.53741],
        [1583712000000, 199.43, 202.81, 208.62, 190.0, 1661331.83553],
        [1583798400000, 202.79, 200.7, 206.2, 195.54, 1020260.107],
        [1583884800000, 200.74, 194.61, 203.18, 181.73, 1079824.90167],
        [1583971200000, 194.61, 107.82, 195.55, 101.2, 3814533.14046],
      ];

      for (const candle of candles) {
        const [, , , high, low] = candle;
        const input: HighLowNumber = {high, low};
        ac.update(input);
        fasterAC.update(input);
      }

      // Result verified with:
      // https://github.com/jesse-ai/jesse/blob/53297462d48ebf43f9df46ab5005076d25073e5e/tests/test_indicators.py#L14
      expect(ac.isStable).toBe(true);
      expect(fasterAC.isStable).toBe(true);

      expect(ac.getResult().toFixed(2)).toBe('-21.97');
      expect(fasterAC.getResult().toFixed(2)).toBe('-21.97');

      expect(ac.momentum.getResult().toFixed(2)).toBe('-9.22');
      expect(fasterAC.momentum.getResult().toFixed(2)).toBe('-9.22');

      expect(ac.lowest?.toFixed(2)).toBe('-21.97');
      expect(fasterAC.lowest?.toFixed(2)).toBe('-21.97');

      expect(ac.highest?.toFixed(2)).toBe('11.65');
      expect(fasterAC.highest?.toFixed(2)).toBe('11.65');
    });

    it('throws an error when there is not enough input data', () => {
      const ac = new AC(5, 34, 5);

      try {
        ac.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
