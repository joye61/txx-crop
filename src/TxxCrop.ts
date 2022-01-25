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
import { createDownload, isPassiveSupport } from "./utils";
import { ControlType, CursorType } from "./types";
// import { AllowImageType, MimeWebp } from "./image";

export class Crop {
  color: number = 0x20c997;

  // 裁剪框中间镂空的遮盖
  cover: Graphics;
  // 代表裁剪框
  box: Rectangle;
  // 裁剪框4个点的坐标
  p1: Point;
  p2: Point;
  p3: Point;
  p4: Point;
  // 4条边上的控制点
  s1: Container;
  s2: Container;
  s3: Container;
  s4: Container;
  // 4个角上的控制点
  a1: Graphics;
  a2: Graphics;
  a3: Graphics;
  a4: Graphics;
  // 可移动区域
  move: Container;

  // 关于尺寸的文字信息
  st: Text;

  // 图片层
  imageLayer: Container;
  // 图片
  image?: Sprite;
  // 控制层
  controlLayer: Container;

  // pixi应用实例
  app: Application;
  // 用于裁剪预览的应用实例
  preview: Application;

  // 缩放时的特定比例，如果这个值不存在，则认为自由缩放
  ratio?: number;
  /**
   * 裁剪结果固定为特定的宽和高，多种场景满足
   * 1、1寸证件照 295*413
   * 2、大1寸证件照 390*567
   * 3、2寸证件照 413*579
   * 4、手动输入
   * 5、A4纸
   */
  fixWidth?: number;
  fixHeight?: number;

  /**
   * 事件控制
   * isControl：是否正在控制裁剪框
   */
  isControl = false;

  // 鼠标指针类型的map映射
  cursorSets: { [key in ControlType]: CursorType };

  constructor(
    // public pixi: typeof PIXI,
    public stageWidth: number,
    public stageHeight: number,
    public previewStageWidth: number,
    public previewStageHeight: number
  ) {
    // const { Point, Graphics, Container, Rectangle, Application, Text } =
    //   this.pixi;
    pixiUtils.skipHello();

    // app和预览app的通用选项
    const commonAppOption = {
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio,
      autoDensity: true,
      // antialias: true
    };

    // 创建应用程序
    this.app = new Application({
      width: this.stageWidth,
      height: this.stageHeight,
      ...commonAppOption,
    });
    // 设置舞台环境可交互
    this.app.stage.interactive = true;

    // 创建预览的环境
    this.preview = new Application({
      width: this.previewStageWidth,
      height: this.previewStageHeight,
      ...commonAppOption,
    });

    // 注册鼠标样式
    const cursorStyles = this.app.renderer.plugins.interaction.cursorStyles;
    cursorStyles[CursorType.s1s3] = CursorType.s1s3;
    cursorStyles[CursorType.s2s4] = CursorType.s2s4;
    cursorStyles[CursorType.a1a3] = CursorType.a1a3;
    cursorStyles[CursorType.a2a4] = CursorType.a2a4;
    cursorStyles[CursorType.move] = CursorType.move;

    // 鼠标指针样式的注册表
    this.cursorSets = {
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

    // 绘制透明网格背景
    const nx = Math.ceil(this.stageWidth / 10);
    const ny = Math.ceil(this.stageHeight / 10);
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

    // 初始化各元素
    this.cover = new Graphics();

    // 声明裁剪框
    this.box = new Rectangle();

    // 初始化4个点
    this.p1 = new Point();
    this.p2 = new Point();
    this.p3 = new Point();
    this.p4 = new Point();

    // 4条边的控制点全透明展示
    this.s1 = new Container();
    this.s2 = new Container();
    this.s3 = new Container();
    this.s4 = new Container();

    // 4个角的控制点需要有初始化绘制
    this.a1 = new Graphics();
    this.a1.beginFill(this.color);
    this.a1.drawPolygon(0, 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12);
    this.a1.endFill();
    this.a2 = new Graphics();
    this.a2.beginFill(this.color);
    this.a2.drawPolygon(0, 0, 12, 0, 12, 12, 8, 12, 8, 4, 0, 4);
    this.a2.endFill();
    this.a3 = new Graphics();
    this.a3.beginFill(this.color);
    this.a3.drawPolygon(8, 0, 12, 0, 12, 12, 0, 12, 0, 8, 8, 8);
    this.a3.endFill();
    this.a4 = new Graphics();
    this.a4.beginFill(this.color);
    this.a4.drawPolygon(0, 0, 4, 0, 4, 8, 12, 8, 12, 12, 0, 12);
    this.a4.endFill();

    // 可移动区域
    this.move = new Container();

    // 图片层，容纳待裁减图片
    this.imageLayer = new Container();

    // 容器层，容纳所有的控制元素
    this.controlLayer = new Container();
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

    // 文字信息
    this.st = new Text("", {
      fill: 0xffffff,
      fontSize: 14,
      lineHeight: 14,
      fontWeight: "200",
    });
    this.st.alpha = 0.3;
    this.st.x = 10;
    this.st.y = this.stageHeight - 24;

    // 将各元素插入到舞台中
    this.app.stage.addChild(grid, this.imageLayer, this.controlLayer, this.st);
    // 初始化控制事件绑定逻辑
    this.initControlEventHandler();
    // 初始化裁剪框位置信息
    this.setInitBox();
    this.updateCover();
    this.updateControls();
  }

  /**
   * 设置待裁减的图片，可多次调用
   * @param file
   */
  async setCropImageByFile(file: File) {
    // 首先删除所有已存在的子节点
    this.imageLayer.removeChildren();
    // 加载图片
    const image = await new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => resolve(img);
    });
    this.image = new Sprite(Texture.from(image));
    this.setCursorStyleEvent("image");
    this.imageLayer.addChild(this.image);
    this.fitImageToStage();
  }

  /**
   * 使图片适配舞台
   */
  fitImageToStage() {
    if (this.image) {
      // 设置转换点为0，0
      this.image.pivot.set(0, 0);
      // 调整图片大小和尺寸以适应窗口
      const vw = this.stageWidth - 8;
      const vh = this.stageHeight - 8;
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
      this.image.x = (this.stageWidth - this.image.width) / 2;
      this.image.y = (this.stageHeight - this.image.height) / 2;

      // 更新逻辑
      this.setInitBox();
      this.updatePreview();
      this.updateCover();
      this.updateControls();
      this.updateTextOfSize();
    }
  }

  /**
   * 重新选择模式
   * @param cropMode
   */
  updateByModeChange(ratio?: number, fixWidth?: number, fixHeight?: number) {
    this.ratio = ratio;
    this.fixWidth = fixWidth;
    this.fixHeight = fixHeight;
    this.setInitBox();
    this.updateCover();
    this.updateControls();
    this.updateTextOfSize();
    this.updatePreview();
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
   * 获取事件处理程序
   * @returns
   */
  initControlEventHandler() {
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

    // 设置默认的鼠标指针样式，只能通过事件监听的方式设置
    const controlSets = Object.keys(this.cursorSets) as Array<ControlType>;
    for (let name of controlSets) {
      if (name !== "image") {
        this.setCursorStyleEvent(name);
      }
    }

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
            maxNx = this.stageWidth - 4;
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
            maxNy = this.stageHeight - 4;
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
              maxNx = this.stageWidth - 4;
              minNy = 4;
              maxNy = y + h - 16;
            }
            // 比例模式
            else {
              // 推断宽度还是高度先到达临界点
              maxNx = this.stageWidth - 4;
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
              maxNx = this.stageWidth - 4;
              minNy = y + 16;
              maxNy = this.stageHeight - 4;
            }
            // 比例模式
            else {
              // 推断宽度还是高度先到达临界点
              maxNx = this.stageWidth - 4;
              maxNy = y + (maxNx - x) / ratio;
              if (maxNy >= this.stageHeight - 4) {
                maxNy = this.stageHeight - 4;
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
              maxNy = this.stageHeight - 4;
            }
            // 比例模式
            else {
              // 推断宽度还是高度先到达临界点
              minNx = 4;
              maxNy = y + (x + w - 4) / ratio;
              if (maxNy >= this.stageHeight - 4) {
                maxNy = this.stageHeight - 4;
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
            let maxNx = this.stageWidth - 4 - w;
            let maxNy = this.stageHeight - 4 - h;
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
        this.updateCover();
        this.updateControls();
        this.updateTextOfSize();
        this.updatePreview();
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
        this.updateTextOfSize();
        this.updatePreview();
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
   * 设置初始化的裁剪框区域
   */
  setInitBox() {
    const initSize = 220;
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
    const x = (this.stageWidth - width) / 2;
    const y = (this.stageHeight - height) / 2;
    this.box.x = x;
    this.box.y = y;
    this.box.width = width;
    this.box.height = height;
  }

  /**
   * 根据4个点更新cover
   */
  updateCover() {
    this.cover.clear();
    const { x, y, width: w, height: h } = this.box;
    // 首先绘制中间镂空的背景
    this.cover.beginFill(0x000000, 0.7);
    this.cover.drawRect(0, 0, this.stageWidth, y);
    this.cover.drawRect(x + w, y, this.stageWidth - x - w, h);
    this.cover.drawRect(0, y + h, this.stageWidth, this.stageHeight - y - h);
    this.cover.drawRect(0, y, x, h);
    this.cover.endFill();
    // 背景中间绘制一个矩形框
    this.cover.lineStyle({
      width: 1,
      color: this.color,
      alignment: 1,
    });
    this.cover.drawRect(x, y, w, h);
    // 绘制4条虚线
    this.cover.lineStyle({
      width: 1,
      color: this.color,
      alpha: 0.3,
    });
    this.cover.moveTo(x + w / 3, y).lineTo(x + w / 3, y + h);
    this.cover.moveTo(x + (2 * w) / 3, y).lineTo(x + (2 * w) / 3, y + h);
    this.cover.moveTo(x, y + h / 3).lineTo(x + w, y + h / 3);
    this.cover.moveTo(x, y + (2 * h) / 3).lineTo(x + w, y + (2 * h) / 3);
  }

  /**
   * 更新8个控制点的位置
   */
  updateControls() {
    const { x, y, width: w, height: h } = this.box;

    // 4条边
    this.s1.x = this.s3.x = x + 8;
    this.s1.y = y - 4;
    this.s3.y = y + h - 5;
    this.s1.hitArea = this.s3.hitArea = new Rectangle(0, 0, w - 16, 9);
    this.s2.x = x + w - 5;
    this.s4.x = x - 4;
    this.s2.y = this.s4.y = y + 8;
    this.s2.hitArea = this.s4.hitArea = new Rectangle(0, 0, 9, h - 16);

    // 4个角
    this.a1.x = x - 4;
    this.a1.y = y - 4;
    this.a2.x = x + w - 8;
    this.a2.y = y - 4;
    this.a3.x = x + w - 8;
    this.a3.y = y + h - 8;
    this.a4.x = x - 4;
    this.a4.y = y + h - 8;

    // 可移动区域
    this.move.x = x + 4;
    this.move.y = y + 4;
    this.move.hitArea = new Rectangle(0, 0, w - 8, h - 8);
  }

  /**
   * 更新输出截图的尺寸信息
   */
  updateTextOfSize() {
    if (!this.image) return;
    const scaleX = this.image.scale.x;
    const scaleY = this.image.scale.y;
    let w = this.box.width / scaleX;
    let h = this.box.height / scaleY;
    if (this.fixWidth && this.fixHeight) {
      w = this.fixWidth;
      h = this.fixHeight;
    }
    this.st.text = `${Math.ceil(w)} × ${Math.ceil(h)}`;
  }

  /**
   * 更新预览
   * @param name
   * @param type
   * @param trimTransparentSide
   */
  updatePreview() {
    if (this.image) {
      const stage = this.preview.stage;
      const w = this.previewStageWidth;
      const h = this.previewStageHeight;
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
  getCropRelativeRect() {
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
   * 裁剪函数，获取最终被裁剪的区域图片
   * @param name 下载文件的名字
   * @param type 下载文件的类型
   * @param trimTransparentSide 是否裁剪截图中的边缘透明像素
   */
  async downloadCropImage(
    name: string,
    type: "png" | "jpg" | "jpeg" | "webp",
    trimTransparentSide = false
  ) {
    if (this.image) {
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
      if (this.fixWidth && this.fixHeight) {
        app.destroy();
        app = new Application({
          width: this.fixWidth,
          height: this.fixHeight,
          backgroundAlpha: 0,
        });
        const newTexture = Sprite.from(canvas);
        newTexture.texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
        newTexture.width = this.fixWidth;
        newTexture.height = this.fixHeight;
        app.stage.addChild(newTexture);
        app.render();
        canvas = app.view;
      }

      // 如果要裁剪掉边缘空白
      if (trimTransparentSide) {
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

      const blob = await new Promise<Blob | null>((resolve) => {
        // let mime: string;
        // if (type === "webp") {
        //   mime = MimeWebp;
        // } else {
        //   mime = AllowImageType[type];
        // }
        // canvas.toBlob(resolve, mime);
        canvas.toBlob(resolve);
      });
      app.destroy();
      createDownload(`${name}.${type}`, blob!);
    }
  }
}
