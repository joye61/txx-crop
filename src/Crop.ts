import {
  Application,
  Point,
  Graphics,
  InteractionEvent,
  Container,
  Rectangle,
  Sprite,
  Text,
  utils as pixiUtils,
  Texture,
  SCALE_MODES,
} from "pixi.js";
import {
  createDownload,
  getColor,
  getDomInfo,
  isPassiveSupport,
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

    // 由于4个角形状不变，只要不改变颜色，只需要绘制一次UI，优先绘制4个角
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
    // 这里的事件监听逻辑主要是处理鼠标相关的东西
    this.initCursorStyleEvent();

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

  getCropAreaAsBlob() {}
  getCropAreaAsImage() {}
  getCropAreaAsCanvas() {}
  downloadCropAreaAsPNG() {}
  downloadCropAreaAsJPEG() {}
  downloadCropAreaAsWEBP() {}
}
