import {
  Application,
  Point,
  Graphics,
  InteractionEvent,
  Container,
  Rectangle,
  Sprite,
  utils as pixiUtils,
  Texture,
  SCALE_MODES,
} from "pixi.js";
import {
  createDownload,
  getColor,
  getDomInfo,
  isPassiveSupport,
  isWebpSupport,
} from "./utils";
import {
  ControlType,
  CursorType,
  RatioChangeOption,
  TxxCropOption,
} from "./types";

export class TxxCrop {
  // 跟舞台一样大的覆盖层，内部有一块镂空的半透明区域，用来模拟裁剪框
  private cover = new Graphics();
  // 镂空区域上的全透明，可移动区域
  private move = new Container();
  // 代表裁剪框的数值信息，包含宽高和坐标点
  private box = new Rectangle();
  // 上边
  private s1 = new Container();
  // 右边
  private s2 = new Container();
  // 下边
  private s3 = new Container();
  // 左边
  private s4 = new Container();
  // 左上角
  private a1 = new Graphics();
  // 右上角
  private a2 = new Graphics();
  // 右下角
  private a3 = new Graphics();
  // 左下角
  private a4 = new Graphics();

  // 裁剪app
  app: Application;
  // 裁剪app宽度
  appWidth: number;
  // 裁剪app高度
  appHeight: number;
  // 预览app
  previewApp?: Application;
  // 预览app宽度
  previewAppWidth?: number;
  // 预览app高度
  previewAppHeight?: number;

  // 裁剪画布的容器
  container: string | HTMLElement;
  // 预览画布的容器
  previewContainer?: string | HTMLElement;
  // 关键颜色
  _primaryColor: number = 0x20c997;
  // 背景色
  showGridBackground = true;
  // 预览框背景色
  showGridPreviewBackground = false;
  // 裁剪时的宽高比，如果不存在，则自由裁剪
  ratio?: number;
  // 裁剪宽度
  cropWidth?: number;
  // 裁剪高度
  cropHeight?: number;
  // 默认裁剪框宽度
  defaultCropBoxWidth = 200;
  // 显示裁剪线
  _showCropMesh = true;

  // 鼠标指针映射
  cursorSets = {
    s1: CursorType.s1s3,
    s2: CursorType.s2s4,
    s3: CursorType.s1s3,
    s4: CursorType.s2s4,
    a1: CursorType.a1a3,
    a2: CursorType.a2a4,
    a3: CursorType.a1a3,
    a4: CursorType.a2a4,
    move: CursorType.move,
    image: CursorType.move,
  };

  // 图片层
  imageLayer = new Container();
  // 图片
  image?: Sprite;
  // 控制层
  controlLayer = new Container();

  // 是否正在操控中
  isControl = false;

  // 是否是处于裁剪状态
  private cropActive = false;

  /**
   * 构造函数
   * @param option
   */
  constructor(option: TxxCropOption) {
    pixiUtils.skipHello();

    // 首先解析各种参数
    if (option.primaryColor) {
      this._primaryColor = getColor(option.primaryColor);
    }
    if (typeof option.showGridBackground === "boolean") {
      this.showGridBackground = option.showGridBackground;
    }
    if (typeof option.showGridPreviewBackground === "boolean") {
      this.showGridPreviewBackground = option.showGridPreviewBackground;
    }
    this.ratio = option.ratio;
    // 只有当裁剪宽度和高度都存在的时候，固定裁剪才有意义
    if (option.cropWidth && option.cropHeight) {
      this.cropWidth = option.cropWidth;
      this.cropHeight = option.cropHeight;
      this.ratio = this.cropWidth / this.cropHeight;
    }
    if (option.defaultCropBoxWidth) {
      this.defaultCropBoxWidth = option.defaultCropBoxWidth;
    }
    if (typeof option.showCropMesh === "boolean") {
      this._showCropMesh = option.showCropMesh;
    }

    // 创建app
    const containerInfo = getDomInfo(option.container);
    if (!containerInfo) {
      throw new Error(`You must specify the mount container for the crop app`);
    }
    this.container = containerInfo.element;
    this.appWidth = containerInfo.width;
    this.appHeight = containerInfo.height;
    this.app = this.createApp(this.appWidth, this.appHeight);
    this.container.appendChild(this.app.view);
    this.app.stage.interactive = true;
    // 注册鼠标样式
    const cursorStyles = this.app.renderer.plugins.interaction.cursorStyles;
    cursorStyles[CursorType.s1s3] = CursorType.s1s3;
    cursorStyles[CursorType.s2s4] = CursorType.s2s4;
    cursorStyles[CursorType.a1a3] = CursorType.a1a3;
    cursorStyles[CursorType.a2a4] = CursorType.a2a4;
    cursorStyles[CursorType.move] = CursorType.move;
    if (this.showGridBackground) {
      const grid = this.createGridLayer(this.appWidth, this.appHeight);
      this.app.stage.addChild(grid);
    }

    // 由于4个角形状不变，只要不改变颜色，只需要绘制一次UI
    this.drawCorners();
    this.controlLayer.addChild(
      this.cover,
      this.s1,
      this.s2,
      this.s3,
      this.s4,
      this.a1,
      this.a2,
      this.a3,
      this.a4,
      this.move
    );

    // 创建预览app
    const previewContainerInfo = getDomInfo(option.previewContainer);
    if (previewContainerInfo) {
      this.previewContainer = previewContainerInfo.element;
      this.previewAppWidth = previewContainerInfo.width;
      this.previewAppHeight = previewContainerInfo.height;
      this.previewApp = this.createApp(
        this.previewAppWidth,
        this.previewAppHeight
      );
      this.previewContainer.appendChild(this.previewApp.view);
      if (this.showGridPreviewBackground) {
        const grid = this.createGridLayer(
          this.previewAppWidth,
          this.previewAppHeight
        );
        this.previewApp.stage.addChild(grid);
      }
    }

    // 这里的事件监听逻辑主要是处理鼠标样式相关
    this.initCursorStyleEvent();
    this.initEventHandler();
  }

  /**
   * 销毁整个app
   */
  destroy() {
    this.app.destroy(true);
    if (this.previewApp) {
      this.previewApp.destroy(true);
    }
  }

  /**
   * 创建一个pixijs的应用程序实例对象
   * @param width
   * @param height
   */
  createApp(width: number, height: number) {
    const app = new Application({
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio,
      autoDensity: true,
      width,
      height,
    });
    return app;
  }

  /**
   * 创建一个网格层
   * @param width
   * @param height
   * @returns
   */
  createGridLayer(width: number, height: number) {
    const nx = Math.ceil(width / 10);
    const ny = Math.ceil(height / 10);
    const grid = new Graphics();
    for (let i = 1; i <= nx; i++) {
      // 判断是否是奇数行
      let isRowOdd = i % 2 === 1;
      for (let j = 1; j <= ny; j++) {
        let isColOdd = j % 2 === 1;
        // 奇数行奇数列或者偶数行偶数列为白色，其他为灰色
        let fillColor = 0xeeeeee;
        if ((isRowOdd && isColOdd) || (!isRowOdd && !isColOdd)) {
          fillColor = 0xffffff;
        }
        grid.beginFill(fillColor);
        grid.drawRect((i - 1) * 10, (j - 1) * 10, 10, 10);
        grid.endFill();
      }
    }
    return grid;
  }

  /**
   * 获取事件处理程序
   * @returns
   */
  initEventHandler() {
    // 临时记录鼠标刚按下时的各种信息
    let sbox: null | Rectangle = null;
    let simg: null | Point = null;
    let spos: null | Point = null;
    let controlName: null | ControlType = null;
    // 临时存储ratio的值，约定ratio有值时为比例模式
    let ratio = this.ratio;

    // 脱离控制状态时，重置逻辑
    const reset = () => {
      this.isControl = false;
      sbox = null;
      simg = null;
      spos = null;
      controlName = null;
    };

    /**
     * 处理指针按下时的逻辑
     * @param event
     */
    const pointerDown = (event: InteractionEvent) => {
      controlName = event.target.name as null | ControlType;
      if (!this.isControl && controlName) {
        this.isControl = true;
        this.app.stage.cursor = this.cursorSets[controlName];
        sbox = this.box.clone();
        spos = event.data.global.clone();
        ratio = this.ratio;
        if (controlName === "image") {
          simg = new Point(this.image!.x, this.image!.y);
        }
      }
    };

    /**
     * 处理指针移动时的逻辑
     * @param event
     * @returns
     */
    const pointerMove = (event: InteractionEvent) => {
      if (this.isControl) {
        // 断言存在声明
        spos = spos as Point;
        sbox = sbox as Rectangle;

        // 当前指针的位置
        const pos = event.data.global;
        let dx = pos.x - spos.x;
        let dy = pos.y - spos.y;
        let { x, y, width: w, height: h } = sbox;

        // 一些临时变量
        let nx: number;
        let ny: number;
        let minNx: number;
        let minNy: number;
        let maxNx: number;
        let maxNy: number;

        switch (controlName) {
          case "s1": {
            // 等比模式不允许拖拽边框
            if (ratio) return;
            // ny代表第1|2个角的y轴
            ny = y + dy;
            minNy = 4;
            maxNy = y + h - 16;
            if (ny <= minNy) ny = minNy;
            if (ny >= maxNy) ny = maxNy;
            this.box.y = ny;
            this.box.height = y + h - ny;
            break;
          }
          case "s2": {
            // 等比模式不允许拖拽边框
            if (ratio) return;
            // nx代表第2|3个角的x轴
            nx = x + w + dx;
            minNx = x + 16;
            maxNx = this.appWidth - 4;
            if (nx <= minNx) nx = minNx;
            if (nx >= maxNx) nx = maxNx;
            this.box.width = nx - x;
            break;
          }
          case "s3": {
            // 等比模式不允许拖拽边框
            if (ratio) return;
            // ny代表第3|4个角的y轴
            ny = y + h + dy;
            minNy = y + 16;
            maxNy = this.appHeight - 4;
            if (ny <= minNy) ny = minNy;
            if (ny >= maxNy) ny = maxNy;
            this.box.height = ny - y;
            break;
          }
          case "s4": {
            if (ratio) return;
            // nx代表第1|4个角的x轴
            nx = x + dx;
            minNx = 4;
            maxNx = x + w - 16;
            if (nx <= minNx) nx = minNx;
            if (nx >= maxNx) nx = maxNx;
            this.box.x = nx;
            this.box.width = x + w - nx;
            break;
          }
          case "a1": {
            // 非比例模式
            if (!ratio) {
              nx = x + dx;
              ny = y + dy;
              minNx = 4;
              maxNx = x + w - 16;
              minNy = 4;
              maxNy = y + h - 16;
            }
            // 比例模式
            else {
              // 推断宽度还是高度先到达临界点
              minNx = 4;
              minNy = y + h - (x + w - 4) / ratio;
              if (minNy <= 4) {
                minNy = 4;
                minNx = x + w - (y + h - 4) * ratio;
              }
              // 根据ratio判断以横轴还是纵轴缩放为主
              if (ratio > 1) {
                nx = x + dx;
                ny = y + h - (x + w - nx) / ratio;
                // 最小高度16
                maxNy = y + h - 16;
                maxNx = x + w - 16 * ratio;
              } else {
                ny = y + dy;
                nx = x + w - (y + h - ny) * ratio;
                // 最小宽度16
                maxNx = x + w - 16;
                maxNy = y + h - 16 / ratio;
              }
            }

            if (nx <= minNx) nx = minNx;
            if (nx >= maxNx) nx = maxNx;
            if (ny <= minNy) ny = minNy;
            if (ny >= maxNy) ny = maxNy;
            this.box.x = nx;
            this.box.y = ny;
            this.box.width = x + w - nx;
            this.box.height = y + h - ny;

            break;
          }

          case "a2": {
            // 非比例模式
            if (!ratio) {
              nx = x + w + dx;
              ny = y + dy;
              minNx = x + 16;
              maxNx = this.appWidth - 4;
              minNy = 4;
              maxNy = y + h - 16;
            }
            // 比例模式
            else {
              // 推断宽度还是高度先到达临界点
              maxNx = this.appHeight - 4;
              minNy = y + h - (maxNx - x) / ratio;
              if (minNy <= 4) {
                minNy = 4;
                maxNx = x + (y + h - 4) * ratio;
              }
              // 根据ratio判断以横轴还是纵轴缩放为主
              if (ratio > 1) {
                nx = x + w + dx;
                ny = y + h - (nx - x) / ratio;
                // 最小高度16
                maxNy = y + h - 16;
                minNx = x + 16 * ratio;
              } else {
                ny = y + dy;
                nx = x + (y + h - ny) * ratio;
                // 最小宽度16
                minNx = x + 16;
                maxNy = y + h - 16 / ratio;
              }
            }

            if (nx <= minNx) nx = minNx;
            if (nx >= maxNx) nx = maxNx;
            if (ny <= minNy) ny = minNy;
            if (ny >= maxNy) ny = maxNy;
            this.box.y = ny;
            this.box.width = nx - x;
            this.box.height = y + h - ny;

            break;
          }
          case "a3": {
            // 非比例模式
            if (!ratio) {
              nx = x + w + dx;
              ny = y + h + dy;
              minNx = x + 16;
              maxNx = this.appWidth - 4;
              minNy = y + 16;
              maxNy = this.appHeight - 4;
            }
            // 比例模式
            else {
              // 推断宽度还是高度先到达临界点
              maxNx = this.appWidth - 4;
              maxNy = y + (maxNx - x) / ratio;
              if (maxNy >= this.appHeight - 4) {
                maxNy = this.appHeight - 4;
                maxNx = x + (maxNy - y) * ratio;
              }
              // 根据ratio判断以横轴还是纵轴缩放为主
              if (ratio > 1) {
                nx = x + w + dx;
                ny = y + (nx - x) / ratio;
                // 最小高度16
                minNy = y + 16;
                minNx = x + 16 * ratio;
              } else {
                ny = y + h + dy;
                nx = x + (ny - y) * ratio;
                // 最小宽度16
                minNx = x + 16;
                minNy = y + 16 / ratio;
              }
            }

            if (nx <= minNx) nx = minNx;
            if (nx >= maxNx) nx = maxNx;
            if (ny <= minNy) ny = minNy;
            if (ny >= maxNy) ny = maxNy;
            this.box.width = nx - x;
            this.box.height = ny - y;
            break;
          }
          case "a4": {
            // 非比例模式
            if (!ratio) {
              nx = x + dx;
              ny = y + h + dy;
              minNx = 4;
              maxNx = x + w - 16;
              minNy = y + 16;
              maxNy = this.appHeight - 4;
            }
            // 比例模式
            else {
              // 推断宽度还是高度先到达临界点
              minNx = 4;
              maxNy = y + (x + w - 4) / ratio;
              if (maxNy >= this.appHeight - 4) {
                maxNy = this.appHeight - 4;
                minNx = x + w - (maxNy - y) * ratio;
              }
              // 根据ratio判断以横轴还是纵轴缩放为主
              if (ratio > 1) {
                nx = x + dx;
                ny = y + (x + w - nx) / ratio;
                // 最小高度16
                minNy = y + 16;
                maxNx = x + w - 16 * ratio;
              } else {
                ny = y + h + dy;
                nx = x + w - (ny - y) * ratio;
                // 最小宽度16
                maxNx = x + w - 16;
                minNy = y + 16 / ratio;
              }
            }

            if (nx <= minNx) nx = minNx;
            if (nx >= maxNx) nx = maxNx;
            if (ny <= minNy) ny = minNy;
            if (ny >= maxNy) ny = maxNy;
            this.box.x = nx;
            this.box.width = x + w - nx;
            this.box.height = ny - y;
            break;
          }
          case "move": {
            let nx = x + dx;
            let ny = y + dy;
            let minNx = 4;
            let minNy = 4;
            let maxNx = this.appWidth - 4 - w;
            let maxNy = this.appHeight - 4 - h;
            if (nx <= minNx) nx = minNx;
            if (ny <= minNy) ny = minNy;
            if (nx >= maxNx) nx = maxNx;
            if (ny >= maxNy) ny = maxNy;
            this.box.x = nx;
            this.box.y = ny;
            break;
          }
          case "image": {
            this.image!.x = simg!.x + dx;
            this.image!.y = simg!.y + dy;
          }
          default:
            break;
        }

        // 更新完了点的坐标，更新UI
        this.updateApp();
        this.updatePreviewApp();
      }
    };

    /**
     * 处理指针弹起时的逻辑
     */
    const pointerUp = () => {
      if (this.isControl) {
        this.app.stage.cursor = "default";
        reset();
      }
    };

    const stage = this.app.stage;
    stage.on("pointerdown", pointerDown);
    stage.on("pointermove", pointerMove);
    stage.on("pointerup", pointerUp);
    stage.on("pointerupoutside", pointerUp);

    // 下面开始执行缩放逻辑
    const doc = document.documentElement;
    let isOnImage = false;

    stage.on("pointermove", (event: InteractionEvent) => {
      if (
        !this.isControl &&
        this.image &&
        this.image.containsPoint(event.data.global)
      ) {
        // 设置鼠标已经位于图片中
        isOnImage = true;

        // 将鼠标坐标转换为image本地
        const local = this.image.toLocal(event.data.global);
        // 更新pivot和pos
        const x = this.image.pivot.x;
        const y = this.image.pivot.y;
        this.image.pivot.x = local.x;
        this.image.pivot.y = local.y;
        // pivot返回的是未经缩放的原始值，因而要乘以缩放系数转换为全局坐标
        this.image.x += (local.x - x) * this.image.scale.x;
        this.image.y += (local.y - y) * this.image.scale.y;
      } else {
        isOnImage = false;
      }
    });
    stage.on("pointerout", () => {
      isOnImage = false;
    });
    const onWheel = (event: WheelEvent) => {
      if (isOnImage) {
        event.preventDefault();
        this.image = this.image as Sprite;

        // 更新尺寸信息
        const ratio = this.image.width / this.image.height;
        let nh = this.image.height - event.deltaY;

        // 下面的逻辑确保了缩放图片的宽度或高度最小值不能小于16
        if (nh <= 16) {
          nh = 16;
        }
        let nw = nh * ratio;
        if (nw <= 16) {
          nw = 16;
          nh = nw / ratio;
        }

        // 更新缩放后的宽度和高度
        this.image.height = nh;
        this.image.width = nw;

        // 更新文字尺寸信息
        this.updatePreviewApp();
      }
    };
    // passive特性有可能不被支持，这里是兼容逻辑
    if (isPassiveSupport()) {
      doc.addEventListener("wheel", onWheel, { passive: false });
    } else {
      doc.addEventListener("wheel", onWheel);
    }
  }

  /**
   * 初始化APP，只要是设置并计算box的初始化值
   */
  initializeApp() {
    const initSize = this.defaultCropBoxWidth ?? 200;
    // 默认认为自由缩放，初始化为正方形
    let width = initSize;
    let height = initSize;
    if (this.ratio && typeof this.ratio === "number") {
      // 约定长边为initSize，短边根据计算得出
      if (this.ratio >= 1) {
        width = initSize;
        height = initSize / this.ratio;
        // 短边不能小于临界值16
        if (height <= 16) {
          height = 16;
          width = 16 * this.ratio;
        }
      } else {
        height = initSize;
        width = initSize * this.ratio;
        // 短边不能小于临界值16
        if (width <= 16) {
          width = 16;
          height = 16 / this.ratio;
        }
      }
    }
    const x = (this.appWidth - width) / 2;
    const y = (this.appHeight - height) / 2;
    this.box.x = x;
    this.box.y = y;
    this.box.width = width;
    this.box.height = height;
  }

  get primaryColor(): number {
    return this._primaryColor;
  }

  set primaryColor(color: string | number) {
    this._primaryColor = getColor(color);
    this.drawCorners();
    this.updateApp();
  }

  /**
   * 绘制4个控制角
   */
  drawCorners() {
    // 清理之前的绘制
    this.a1.clear();
    this.a2.clear();
    this.a3.clear();
    this.a4.clear();
    // 重新绘制
    this.a1.beginFill(this.primaryColor);
    this.a1.drawPolygon(0, 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12);
    this.a1.endFill();
    this.a2.beginFill(this.primaryColor);
    this.a2.drawPolygon(0, 0, 12, 0, 12, 12, 8, 12, 8, 4, 0, 4);
    this.a2.endFill();
    this.a3.beginFill(this.primaryColor);
    this.a3.drawPolygon(8, 0, 12, 0, 12, 12, 0, 12, 0, 8, 8, 8);
    this.a3.endFill();
    this.a4.beginFill(this.primaryColor);
    this.a4.drawPolygon(0, 0, 4, 0, 4, 8, 12, 8, 12, 12, 0, 12);
    this.a4.endFill();
  }

  get showCropMesh(): boolean {
    return this._showCropMesh;
  }

  set showCropMesh(show: boolean) {
    if (this._showCropMesh !== show) {
      this._showCropMesh = show;
      this.updateApp();
    }
  }

  /**
   * 更新app的UI，不包含图片
   * 1、覆盖层
   * 2、4个角控制点
   * 3、4条边控制点
   */
  updateApp() {
    this.cover.clear();
    const { x, y, width: w, height: h } = this.box;
    // 首先绘制中间镂空的背景
    this.cover.beginFill(0x000000, 0.7);
    this.cover.drawRect(0, 0, this.appWidth, y);
    this.cover.drawRect(x + w, y, this.appWidth - x - w, h);
    this.cover.drawRect(0, y + h, this.appWidth, this.appHeight - y - h);
    this.cover.drawRect(0, y, x, h);
    this.cover.endFill();
    // 背景中间绘制一个矩形框
    this.cover.lineStyle({
      width: 1,
      color: this.primaryColor,
      alignment: 1,
    });
    this.cover.drawRect(x, y, w, h);
    // 如果app设置了显示裁剪框中间的网格线
    if (this.showCropMesh) {
      this.cover.lineStyle({
        width: 1,
        color: this.primaryColor,
        alpha: 0.3,
      });
      this.cover.moveTo(x + w / 3, y).lineTo(x + w / 3, y + h);
      this.cover.moveTo(x + (2 * w) / 3, y).lineTo(x + (2 * w) / 3, y + h);
      this.cover.moveTo(x, y + h / 3).lineTo(x + w, y + h / 3);
      this.cover.moveTo(x, y + (2 * h) / 3).lineTo(x + w, y + (2 * h) / 3);
    }

    // 更新4条边位置
    this.s1.x = this.s3.x = x + 8;
    this.s1.y = y - 4;
    this.s3.y = y + h - 5;
    this.s1.hitArea = this.s3.hitArea = new Rectangle(0, 0, w - 16, 9);
    this.s2.x = x + w - 5;
    this.s4.x = x - 4;
    this.s2.y = this.s4.y = y + 8;
    this.s2.hitArea = this.s4.hitArea = new Rectangle(0, 0, 9, h - 16);

    // 更新4个角
    this.a1.x = x - 4;
    this.a1.y = y - 4;
    this.a2.x = x + w - 8;
    this.a2.y = y - 4;
    this.a3.x = x + w - 8;
    this.a3.y = y + h - 8;
    this.a4.x = x - 4;
    this.a4.y = y + h - 8;

    // 更新可移动区域位置
    this.move.x = x + 4;
    this.move.y = y + 4;
    this.move.hitArea = new Rectangle(0, 0, w - 8, h - 8);
  }

  /**
   * 更新预览app的UI
   */
  updatePreviewApp() {
    if (!this.image || !this.previewApp) return;

    const stage = this.previewApp.stage;
    const w = this.previewAppWidth!;
    const h = this.previewAppHeight!;
    // 首先移除所有的子元素
    stage.removeChildren();
    // 添加新的图片元素
    const r1 = this.getCropRelativeRect();

    const r2 = new Rectangle(
      0,
      0,
      this.image.texture.width,
      this.image.texture.height
    );
    const texture = this.image.texture.clone();
    texture.frame = this.intersection(r1, r2);
    texture.updateUvs();
    const image = new Sprite(texture);
    stage.addChild(image);
    if (image.width / image.height > w / h) {
      if (image.width > w) {
        const ratio = image.width / w;
        image.width = w;
        image.height = image.height / ratio;
      }
    } else {
      if (image.height > h) {
        const ratio = image.height / h;
        image.height = h;
        image.width = image.width / ratio;
      }
    }
    image.x = (w - image.width) / 2;
    image.y = (h - image.height) / 2;
  }

  /**
   * 求两个矩形的相交矩形
   * @param r1 第一个矩形
   * @param r2 第二个矩形
   * @returns 相交的矩形
   */
  intersection(r1: Rectangle, r2: Rectangle) {
    const outRect = new Rectangle();
    const x0 = r1.x < r2.x ? r2.x : r1.x;
    const x1 = r1.right > r2.right ? r2.right : r1.right;
    if (x1 <= x0) {
      outRect.x = outRect.y = outRect.width = outRect.height = 0;
      return outRect;
    }
    const y0 = r1.y < r2.y ? r2.y : r1.y;
    const y1 = r1.bottom > r2.bottom ? r2.bottom : r1.bottom;
    if (y1 <= y0) {
      outRect.x = outRect.y = outRect.width = outRect.height = 0;
      return outRect;
    }
    outRect.x = x0;
    outRect.y = y0;
    outRect.width = x1 - x0;
    outRect.height = y1 - y0;
    return outRect;
  }

  /**
   * 获取裁剪框的相对图片矩形区域
   * @returns
   */
  private getCropRelativeRect() {
    const rect = new Rectangle();
    if (this.image) {
      const imgb = this.image.getBounds();
      const scaleX = this.image.scale.x;
      const scaleY = this.image.scale.y;
      rect.x = (this.box.x - imgb.x) / scaleX;
      rect.y = (this.box.y - imgb.y) / scaleY;
      rect.width = this.box.width / scaleX;
      rect.height = this.box.height / scaleY;
    }
    return rect;
  }

  /**
   * 设置鼠标指针相关的事件
   * @param type
   */
  setCursorStyleEvent(type: ControlType) {
    const element = this[type as ControlType] as Container;
    element.interactive = true;
    element.name = type;
    element.on("pointerover", () => {
      if (!this.isControl) {
        this.app.stage.cursor = this.cursorSets[<ControlType>element.name];
      }
    });
    element.on("pointerout", () => {
      if (!this.isControl) {
        this.app.stage.cursor = "default";
      }
    });
  }

  /**
   * 设置控制点的鼠标样式监听逻辑
   */
  private initCursorStyleEvent() {
    const controlSets = Object.keys(this.cursorSets) as Array<ControlType>;
    for (let name of controlSets) {
      if (name !== "image") {
        this.setCursorStyleEvent(name);
      }
    }
  }

  /**
   * 通过更换图片更新UI
   * @param image 图片URL | HTMLImageElement | 图片文件
   */
  async updateByImage(image: HTMLImageElement | File | Blob | string) {
    this.imageLayer.removeChildren();
    let tmpImage: HTMLImageElement;
    if (image instanceof HTMLImageElement) {
      tmpImage = image;
    } else {
      let url: string;
      if (typeof image === "string") {
        url = image;
      } else {
        url = URL.createObjectURL(image);
      }
      tmpImage = await new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
      });
    }

    this.image = new Sprite(Texture.from(tmpImage));
    this.setCursorStyleEvent("image");
    this.imageLayer.addChild(this.image);
    // 裁剪不活跃状态变为裁剪活跃状态
    if (!this.cropActive) {
      this.app.stage.addChild(this.imageLayer, this.controlLayer);
      this.cropActive = true;
    }

    this.fitToViewport();
  }

  /**
   * 清空图片，裁剪舞台上的裁剪框都要清理
   */
  clearImage() {
    if (this.image) {
      this.imageLayer.removeChild(this.image);
      this.image = undefined;
      this.app.stage.removeChild(this.imageLayer, this.controlLayer);
      this.cropActive = false;
    }
  }

  /**
   * 使图片和裁剪框适应窗口
   */
  fitToViewport() {
    if (!this.image) return;
    // 设置转换点为0，0
    this.image.pivot.set(0, 0);
    // 调整图片大小和尺寸以适应窗口
    const vw = this.appWidth - 8;
    const vh = this.appHeight - 8;
    const ratioViewport = vw / vh;
    const sw = this.image.texture.width;
    const sh = this.image.texture.height;
    this.image.width = sw;
    this.image.height = sh;
    const ratioImage = sw / sh;
    if (ratioImage >= ratioViewport) {
      // 只有当图片超出容器范围的时候，才进行缩放
      if (vw <= sw) {
        this.image.width = vw;
        this.image.height = vw / ratioImage;
      }
    } else {
      // 只有当图片超出容器范围的时候，才进行缩放
      if (vh <= sh) {
        this.image.height = vh;
        this.image.width = vh * ratioImage;
      }
    }

    // 更新图片的初始位置
    this.image.x = (this.appWidth - this.image.width) / 2;
    this.image.y = (this.appHeight - this.image.height) / 2;

    // 更新逻辑
    this.initializeApp();
    this.updateApp();
    this.updatePreviewApp();
  }

  /**
   * 通过ratio的变化来更新
   * @param option RatioChangeOption
   */
  updateByRatio(option: RatioChangeOption) {
    const setFreeRatio = () => {
      this.ratio = undefined;
      this.cropWidth = undefined;
      this.cropHeight = undefined;
    };
    switch (option.type) {
      case "free":
        setFreeRatio();
        break;
      case "ratio":
        if (option.ratio) {
          this.ratio = undefined;
          this.cropWidth = undefined;
          this.cropHeight = undefined;
        } else {
          setFreeRatio();
        }
        break;
      case "fixed":
        if (option.cropWidth && option.cropHeight) {
          this.ratio = undefined;
          this.cropWidth = option.cropWidth;
          this.cropHeight = option.cropHeight;
        } else {
          setFreeRatio();
        }
        break;
      default:
        setFreeRatio();
        break;
    }
    this.initializeApp();
    this.updateApp();
    this.updatePreviewApp();
  }

  /**
   * 裁剪图片，获取裁剪区域为canvas
   * @param trim
   */
  getCropAreaAsCanvas(trim: boolean = false): HTMLCanvasElement | undefined {
    if (!this.image) return;
    const rect = this.getCropRelativeRect();
    let app: Application | null = new Application({
      width: rect.width,
      height: rect.height,
      backgroundAlpha: 0,
    });

    const texture = this.image.texture.clone();
    const sprite = new Sprite(texture);
    sprite.texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
    sprite.x = -rect.x;
    sprite.y = -rect.y;
    app.stage.addChild(sprite);
    app.render();

    let canvas: HTMLCanvasElement = app.view;
    // 如果是固定宽高模式，还需要缩放canvas
    if (this.cropWidth && this.cropHeight) {
      app.destroy();
      app = new Application({
        width: this.cropWidth,
        height: this.cropHeight,
        backgroundAlpha: 0,
      });
      const newTexture = Sprite.from(canvas);
      newTexture.texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
      newTexture.width = this.cropWidth;
      newTexture.height = this.cropHeight;
      app.stage.addChild(newTexture);
      app.render();
      canvas = app.view;
    }

    // 如果要裁剪掉边缘空白
    if (trim) {
      // 因为默认启用了webgl，所以先转换为2d模式，以便可以读取ImageData
      const convert = document.createElement("canvas");
      convert.width = app.renderer.width;
      convert.height = app.renderer.height;
      convert.getContext("2d")!.drawImage(canvas, 0, 0);
      // 现在可以读取转换后的canvas的数据了
      const trimResult = pixiUtils.trimCanvas(convert);
      if (trimResult.data instanceof ImageData) {
        const tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = trimResult.width;
        tmpCanvas.height = trimResult.height;
        const context = tmpCanvas.getContext("2d")!;
        context.putImageData(trimResult.data, 0, 0);
        canvas = tmpCanvas;
      }
    }

    return canvas;
  }

  /**
   * 获取裁剪区的内容为blob
   * @param type
   * @param trim
   * @returns
   */
  async getCropAreaAsBlob(
    type: "png" | "jpg" | "jpeg" | "webp",
    trim: boolean = false
  ): Promise<Blob | null> {
    const canvas = this.getCropAreaAsCanvas(trim);
    if (!canvas) return null;
    const mimeMap = {
      JPG: "image/jpeg",
      JPEG: "image/jpeg",
      PNG: "image/png",
      WEBP: "image/webp",
    };
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        resolve,
        mimeMap[type.toUpperCase() as keyof typeof mimeMap]
      );
    });
    return blob;
  }

  /**
   * 读取裁剪区的内容为图片
   */
  async getCropAreaAsImage(
    trim: boolean = false
  ): Promise<HTMLImageElement | null> {
    const canvas = this.getCropAreaAsCanvas(trim);
    if (!canvas) return null;
    return new Promise<HTMLImageElement | null>((resolve) => {
      const img = document.createElement("img");
      img.src = canvas.toDataURL();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  }

  /**
   * 下载裁剪区为png格式
   * @param name
   * @param trim
   */
  async downloadCropAreaAsPNG(name: string, trim: boolean = false) {
    const blob = await this.getCropAreaAsBlob("png", trim);
    if (blob) {
      createDownload(`${name}.png`, blob);
    }
  }

  /**
   * 下载裁剪区为jpeg格式
   * @param name
   * @param trim
   */
  async downloadCropAreaAsJPEG(name: string, trim: boolean = false) {
    const blob = await this.getCropAreaAsBlob("jpeg", trim);
    if (blob) {
      createDownload(`${name}.jpg`, blob);
    }
  }

  /**
   * 下载裁剪区为webp格式
   * @param name
   * @param trim
   */
  async downloadCropAreaAsWEBP(name: string, trim: boolean = false) {
    if (!isWebpSupport()) {
      throw new Error(`Current browser does not support webp format`);
    }
    const blob = await this.getCropAreaAsBlob("webp", trim);
    if (blob) {
      createDownload(`${name}.webp`, blob);
    }
  }
}
