/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SpecimenId, LaserConfig } from '../types/lab';

interface Props {
  specimenId: SpecimenId;
  laser: LaserConfig;
  onReady?: () => void;
}

interface Point2D {
  x: number;
  y: number;
}

const MAX_HULL_POINTS = 128;
const _hullPtsPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));
const _hullSortedPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));
const _hullLowerPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));
const _hullUpperPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));
const _hullResultPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));

const crossProduct = (o: Point2D, a: Point2D, b: Point2D): number => {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
};

// Thuật toán Convex Hull Andrew's Monotone Chain - Zero Allocation (tái sử dụng pool tĩnh 100%)
const computeConvexHullInPlace = (pts: Point2D[], count: number): { hull: Point2D[]; size: number } => {
  if (count <= 2) {
    return { hull: pts, size: count };
  }

  for (let i = 0; i < count; i++) {
    _hullSortedPool[i].x = pts[i].x;
    _hullSortedPool[i].y = pts[i].y;
  }

  // Insertion sort cho N <= 16: Siêu nhanh, không tạo mảng rác (zero GC)
  for (let i = 1; i < count; i++) {
    const px = _hullSortedPool[i].x;
    const py = _hullSortedPool[i].y;
    let j = i - 1;
    while (j >= 0 && (_hullSortedPool[j].x > px || (_hullSortedPool[j].x === px && _hullSortedPool[j].y > py))) {
      _hullSortedPool[j + 1].x = _hullSortedPool[j].x;
      _hullSortedPool[j + 1].y = _hullSortedPool[j].y;
      j--;
    }
    _hullSortedPool[j + 1].x = px;
    _hullSortedPool[j + 1].y = py;
  }

  let lowerCount = 0;
  for (let i = 0; i < count; i++) {
    const pt = _hullSortedPool[i];
    while (lowerCount >= 2 && crossProduct(_hullLowerPool[lowerCount - 2], _hullLowerPool[lowerCount - 1], pt) <= 0) {
      lowerCount--;
    }
    _hullLowerPool[lowerCount].x = pt.x;
    _hullLowerPool[lowerCount].y = pt.y;
    lowerCount++;
  }

  let upperCount = 0;
  for (let i = count - 1; i >= 0; i--) {
    const pt = _hullSortedPool[i];
    while (upperCount >= 2 && crossProduct(_hullUpperPool[upperCount - 2], _hullUpperPool[upperCount - 1], pt) <= 0) {
      upperCount--;
    }
    _hullUpperPool[upperCount].x = pt.x;
    _hullUpperPool[upperCount].y = pt.y;
    upperCount++;
  }

  let resultCount = 0;
  for (let i = 0; i < lowerCount - 1; i++) {
    _hullResultPool[resultCount].x = _hullLowerPool[i].x;
    _hullResultPool[resultCount].y = _hullLowerPool[i].y;
    resultCount++;
  }
  for (let i = 0; i < upperCount - 1; i++) {
    _hullResultPool[resultCount].x = _hullUpperPool[i].x;
    _hullResultPool[resultCount].y = _hullUpperPool[i].y;
    resultCount++;
  }

  return { hull: _hullResultPool, size: resultCount };
};

// Độ cao tâm chiếu cố định của buồng thí nghiệm (giữ nguyên độ cao đèn tuyệt đối khi đổi vật mẫu)
const FIXED_TARGET_Y = 0.555;

export const LabCanvas3D: React.FC<Props> = ({
  specimenId,
  laser,
  onReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({
    specimenId,
    laser,
  });

  stateRef.current.specimenId = specimenId;
  stateRef.current.laser = laser;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- 1. Scene, Camera (Phép Chiếu Song Song / Orthographic Camera), Renderer ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const aspect = container.clientWidth / container.clientHeight;
    const frustumHeight = Math.max(8.4, 15.2 / aspect);
    const frustumHalfH = frustumHeight / 2;
    const frustumHalfW = frustumHalfH * aspect;

    // Phép chiếu song song chuẩn hình học không gian SGK Toán 11
    const camera = new THREE.OrthographicCamera(
      -frustumHalfW,
      frustumHalfW,
      frustumHalfH,
      -frustumHalfH,
      0.1,
      160.0
    );

    const targetCenter = new THREE.Vector3(0, 1.10, 0);

    // Cố định góc nhìn chuẩn: cạnh trước & cạnh sau mặt phẳng (P) nằm ngang 100% trên màn hình
    // Nâng cao tầm nhìn và bao quát cả nguồn sáng mặt trời ở trên cao lẫn hình bóng dài trên mặt sàn
    camera.position.set(2.4, 3.6, 6.8);
    camera.up.set(0, 1, 0);
    camera.lookAt(targetCenter);

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    container.appendChild(renderer.domElement);

    // Môi trường phản xạ phòng thí nghiệm
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnvTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = roomEnvTexture;

    // --- 2. OrbitControls (Khóa Xoay 3D - Chỉ Kéo khung hình và Phóng to/Thu nhỏ) ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false; // Khóa hoàn toàn tính năng xoay 3D theo đúng yêu cầu
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.copy(targetCenter);
    controls.minZoom = 0.4;
    controls.maxZoom = 4.0;

    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

    renderer.domElement.style.cursor = 'grab';

    const onPointerDown = () => {
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onPointerUp = () => {
      renderer.domElement.style.cursor = 'grab';
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    // --- 3. Studio Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x64748b, 0.6);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(6, 8, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.45);
    fillLight.position.set(-6, 6, -5);
    scene.add(fillLight);

    const lampRimLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    lampRimLight.position.set(0, -3, 6);
    scene.add(lampRimLight);

    // --- 4. Mặt phẳng hình chiếu (P) - Hình bình hành ngang chuẩn SGK Toán 11 ---
    const planeW = 12.0;
    const planeD = 3.2;
    const planeSkew = 0.70;
    const standH = 0; // Vật thể đặt ngay trên mặt phẳng nền, chuẩn thực tế và khoa học
    const floorY = 0.004; // Cao độ bề mặt phẳng hình chiếu (P)

    // Vector phương ngang màn hình trên mặt nền và phương sâu trực giao
    const u_floor = new THREE.Vector3(camera.position.z, 0, -camera.position.x).normalize();
    const w_depth = new THREE.Vector3(-camera.position.x, 0, -camera.position.z).normalize();

    const stageGroup = new THREE.Group();

    const halfW = planeW / 2;
    const halfD = planeD / 2;

    const getParallelogramVertex = (xLocal: number, zLocal: number, yLevel: number) => {
      return new THREE.Vector3()
        .addScaledVector(u_floor, xLocal + planeSkew * zLocal)
        .addScaledVector(w_depth, zLocal)
        .setY(yLevel);
    };

    const v0_top = getParallelogramVertex(-halfW, -halfD, floorY);
    const v1_top = getParallelogramVertex(halfW, -halfD, floorY);
    const v2_top = getParallelogramVertex(halfW, halfD, floorY);
    const v3_top = getParallelogramVertex(-halfW, halfD, floorY);

    const v0_bot = getParallelogramVertex(-halfW, -halfD, -0.012);
    const v1_bot = getParallelogramVertex(halfW, -halfD, -0.012);
    const v2_bot = getParallelogramVertex(halfW, halfD, -0.012);
    const v3_bot = getParallelogramVertex(-halfW, halfD, -0.012);

    // Khối đế phẳng dày hình bình hành
    const basePlateGeo = new THREE.BufferGeometry();
    const basePlatePositions: number[] = [];

    const addQuad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
      basePlatePositions.push(
        a.x, a.y, a.z,  b.x, b.y, b.z,  c.x, c.y, c.z,
        a.x, a.y, a.z,  c.x, c.y, c.z,  d.x, d.y, d.z
      );
    };

    // Mặt đáy dưới
    addQuad(v0_bot, v3_bot, v2_bot, v1_bot);
    // 4 Mặt bên của phiến đế
    addQuad(v0_bot, v1_bot, v1_top, v0_top); // Cạnh trước
    addQuad(v1_bot, v2_bot, v2_top, v1_top); // Cạnh phải
    addQuad(v2_bot, v3_bot, v3_top, v2_top); // Cạnh sau
    addQuad(v3_bot, v0_bot, v0_top, v3_top); // Cạnh trái

    basePlateGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(basePlatePositions, 3)
    );
    basePlateGeo.computeVertexNormals();

    const basePlateMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.6,
      metalness: 0.25,
      depthWrite: false,
    });
    const basePlateMesh = new THREE.Mesh(basePlateGeo, basePlateMat);
    stageGroup.add(basePlateMesh);

    // 4 Cạnh viền mặt phẳng (P) sắc nét chuẩn kỹ thuật TCVN/ISO
    const floorBorderGeo = new THREE.BufferGeometry();
    const floorBorderPos = new Float32Array([
      v0_top.x, 0.006, v0_top.z,  v1_top.x, 0.006, v1_top.z,
      v1_top.x, 0.006, v1_top.z,  v2_top.x, 0.006, v2_top.z,
      v2_top.x, 0.006, v2_top.z,  v3_top.x, 0.006, v3_top.z,
      v3_top.x, 0.006, v3_top.z,  v0_top.x, 0.006, v0_top.z,
    ]);
    floorBorderGeo.setAttribute('position', new THREE.BufferAttribute(floorBorderPos, 3));
    const floorBorderMat = new THREE.LineBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: false,
    });
    const floorBorderLine = new THREE.LineSegments(floorBorderGeo, floorBorderMat);
    floorBorderLine.renderOrder = 25;
    stageGroup.add(floorBorderLine);

    // Giới hạn kéo khung hình chuẩn xác (Pan Boundary Constraint)
    const focusAnchor = new THREE.Vector3();
    const tempProj = new THREE.Vector3();
    const camRight = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    const shiftVec = new THREE.Vector3();

    const clampPanToBounds = () => {
      camera.updateMatrixWorld();
      const width = container ? container.clientWidth : window.innerWidth;
      const isMobile = width < 768;

      focusAnchor.set(0, 1.10, 0);

      const limitX = isMobile ? 0.78 : 0.82;
      const minLimitY = isMobile ? -0.65 : -0.70;
      const maxLimitY = isMobile ? 0.65 : 0.70;

      tempProj.copy(focusAnchor).project(camera);

      let deltaNdcX = 0;
      let deltaNdcY = 0;

      if (tempProj.x < -limitX) {
        deltaNdcX = -limitX - tempProj.x;
      } else if (tempProj.x > limitX) {
        deltaNdcX = limitX - tempProj.x;
      }

      if (tempProj.y < minLimitY) {
        deltaNdcY = minLimitY - tempProj.y;
      } else if (tempProj.y > maxLimitY) {
        deltaNdcY = maxLimitY - tempProj.y;
      }

      if (deltaNdcX !== 0 || deltaNdcY !== 0) {
        const frustumW = (camera.right - camera.left) / camera.zoom;
        const frustumH = (camera.top - camera.bottom) / camera.zoom;

        camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

        const du = -deltaNdcX * (frustumW / 2);
        const dv = -deltaNdcY * (frustumH / 2);

        shiftVec
          .set(0, 0, 0)
          .addScaledVector(camRight, du)
          .addScaledVector(camUp, dv);

        camera.position.add(shiftVec);
        controls.target.add(shiftVec);
        camera.updateMatrixWorld();

        const internalControls = controls as unknown as { _panOffset?: THREE.Vector3 };
        if (internalControls._panOffset) {
          internalControls._panOffset.set(0, 0, 0);
        }
      }
    };

    // Màn chiếu đáy Dynamic Physics Canvas
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 2400;
    floorCanvas.height = 640;
    const floorCtx = floorCanvas.getContext('2d')!;

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Mặt phẳng hình bình hành hiển thị texture chiếu động
    const floorGeo = new THREE.BufferGeometry();
    const floorVerts = new Float32Array([
      v0_top.x, floorY, v0_top.z,
      v1_top.x, floorY, v1_top.z,
      v2_top.x, floorY, v2_top.z,

      v0_top.x, floorY, v0_top.z,
      v2_top.x, floorY, v2_top.z,
      v3_top.x, floorY, v3_top.z,
    ]);
    const floorUvs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,

      0, 0,
      1, 1,
      0, 1,
    ]);
    const floorNormals = new Float32Array([
      0, 1, 0,  0, 1, 0,  0, 1, 0,
      0, 1, 0,  0, 1, 0,  0, 1, 0,
    ]);
    floorGeo.setAttribute('position', new THREE.BufferAttribute(floorVerts, 3));
    floorGeo.setAttribute('uv', new THREE.BufferAttribute(floorUvs, 2));
    floorGeo.setAttribute('normal', new THREE.BufferAttribute(floorNormals, 3));

    const floorMat = new THREE.MeshBasicMaterial({
      map: floorTexture,
      depthWrite: false,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    stageGroup.add(floorMesh);

    scene.add(stageGroup);

    // --- 5. Laser Lamp Unit & Cột Sáng Thể Tích (Đại diện nguồn sáng mặt trời trên cao) ---
    const beamRadius = 1.10;
    const lampRadius = 1.10;

    const laserHeadGroup = new THREE.Group();
    laserHeadGroup.renderOrder = 2;
    const housingH = 0.65;

    const darkGrayBodyMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      metalness: 0.35,
      roughness: 0.35,
      depthWrite: true,
    });

    const whiteFaceMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthWrite: true,
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.2,
      depthWrite: true,
    });

    const housingGeo = new THREE.CylinderGeometry(
      lampRadius,
      lampRadius,
      housingH,
      128,
      1,
      true
    );
    const housingMesh = new THREE.Mesh(housingGeo, darkGrayBodyMat);
    laserHeadGroup.add(housingMesh);

    // Mặt trên đèn
    const topFaceGeo = new THREE.CircleGeometry(lampRadius, 128);
    const topFaceMesh = new THREE.Mesh(topFaceGeo, whiteFaceMat);
    topFaceMesh.rotation.x = -Math.PI / 2;
    topFaceMesh.position.set(0, housingH / 2, 0);
    laserHeadGroup.add(topFaceMesh);

    const topRimGeo = new THREE.RingGeometry(lampRadius - 0.035, lampRadius, 128);
    const topRimMesh = new THREE.Mesh(topRimGeo, rimMat);
    topRimMesh.rotation.x = -Math.PI / 2;
    topRimMesh.position.set(0, housingH / 2 + 0.001, 0);
    laserHeadGroup.add(topRimMesh);

    // Mặt dưới thấu kính đèn
    const botFaceGeo = new THREE.CircleGeometry(beamRadius, 128);
    const botFaceMesh = new THREE.Mesh(botFaceGeo, whiteFaceMat);
    botFaceMesh.rotation.x = Math.PI / 2;
    botFaceMesh.position.set(0, -housingH / 2, 0);
    laserHeadGroup.add(botFaceMesh);

    const botRimGeo = new THREE.RingGeometry(beamRadius - 0.035, beamRadius, 128);
    const botRimMesh = new THREE.Mesh(botRimGeo, rimMat);
    botRimMesh.rotation.x = Math.PI / 2;
    botRimMesh.position.set(0, -housingH / 2 - 0.001, 0);
    laserHeadGroup.add(botRimMesh);

    scene.add(laserHeadGroup);

    // Cột sáng Laser thể tích
    const NUM_SEGMENTS = 128;
    const beamPositions = new Float32Array((NUM_SEGMENTS + 1) * 2 * 3);
    const beamIndices: number[] = [];

    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const topCurrent = i * 2;
      const botCurrent = i * 2 + 1;
      const topNext = (i + 1) * 2;
      const botNext = (i + 1) * 2 + 1;

      beamIndices.push(topCurrent, botCurrent, botNext);
      beamIndices.push(topCurrent, botNext, topNext);
    }

    const beamBufferGeo = new THREE.BufferGeometry();
    beamBufferGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(beamPositions, 3)
    );
    beamBufferGeo.setIndex(beamIndices);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    const beamMesh = new THREE.Mesh(beamBufferGeo, beamMat);
    beamMesh.renderOrder = 5;
    scene.add(beamMesh);

    // Silhouette Border Lines của cột sáng
    const beamSilhouetteGroup = new THREE.Group();
    const silPositions = new Float32Array(4 * 3);
    const silGeo = new THREE.BufferGeometry();
    silGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(silPositions, 3)
    );

    const silContrastMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.65,
      depthTest: true,
      depthWrite: false,
    });
    const beamSilhouetteContrastLine = new THREE.LineSegments(silGeo, silContrastMat);
    beamSilhouetteContrastLine.renderOrder = 6;
    beamSilhouetteGroup.add(beamSilhouetteContrastLine);

    const silMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      depthTest: true,
      depthWrite: false,
    });
    const beamSilhouetteLine = new THREE.LineSegments(silGeo, silMat);
    beamSilhouetteLine.renderOrder = 7;
    beamSilhouetteGroup.add(beamSilhouetteLine);

    scene.add(beamSilhouetteGroup);

    // --- 6. Specimen Suspended in Space (Vật thể trong không gian) ---
    const specimenMeshGroup = new THREE.Group();
    specimenMeshGroup.renderOrder = 10;
    // Đặt chéo khối hình theo chuẩn SGK để nhìn rõ cả 3 mặt: Mặt trước, Mặt bên và Mặt trên
    const rotY_align = Math.atan2(camera.position.x, camera.position.z);
    const specimenRotY = rotY_align - (32 * Math.PI) / 180;
    specimenMeshGroup.rotation.y = specimenRotY;
    scene.add(specimenMeshGroup);

    // Tạo hình học khối chóp tứ giác đều chuẩn SGK Toán 11 (đáy hình vuông ABCD tâm O, đỉnh S nằm trên trục vuông góc tại O)
    const createPyramidGeometry = (halfA: number, h: number) => {
      const geo = new THREE.BufferGeometry();
      const A = [-halfA, 0, -halfA];
      const B = [halfA, 0, -halfA];
      const C = [halfA, 0, halfA];
      const D = [-halfA, 0, halfA];
      const S = [0, h, 0];

      const positions = [
        // Mặt bên SAB: S, B, A
        ...S, ...B, ...A,
        // Mặt bên SBC: S, C, B
        ...S, ...C, ...B,
        // Mặt bên SCD: S, D, C
        ...S, ...D, ...C,
        // Mặt bên SDA: S, A, D
        ...S, ...A, ...D,
        // Mặt đáy ABCD (2 tam giác)
        ...A, ...B, ...C,
        ...A, ...C, ...D,
      ];
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.computeVertexNormals();
      return geo;
    };

    const setupLineDistances = (geo: THREE.BufferGeometry) => {
      const pos = geo.attributes.position;
      const count = pos.count;
      const dist = new Float32Array(count);
      let total = 0;
      for (let i = 0; i < count; i += 2) {
        const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
        const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
        const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
        dist[i] = total;
        total += len;
        dist[i + 1] = total;
      }
      geo.setAttribute('lineDistance', new THREE.BufferAttribute(dist, 1));
      return geo;
    };

    // Chuẩn kỹ thuật không gian 3D (TCVN / ISO): Cả nét thấy và nét đứt đều đồng nhất màu sắc
    const SPECIMEN_EDGE_COLOR = 0x082f49;

    const visibleEdgeMat = new THREE.LineBasicMaterial({
      color: SPECIMEN_EDGE_COLOR,
      depthFunc: THREE.LessEqualDepth,
      depthTest: true,
      depthWrite: false,
      transparent: true,
    });

    const hiddenEdgeMat = new THREE.LineDashedMaterial({
      color: SPECIMEN_EDGE_COLOR,
      dashSize: 0.035,
      gapSize: 0.02,
      depthFunc: THREE.GreaterDepth,
      depthTest: true,
      depthWrite: false,
      transparent: true,
    });

    const createScientificEdges = (edgesGeo: THREE.BufferGeometry) => {
      const edgeGroup = new THREE.Group();
      const dashedGeo = setupLineDistances(edgesGeo.clone());
      const hiddenLine = new THREE.LineSegments(dashedGeo, hiddenEdgeMat);
      hiddenLine.renderOrder = 20;
      edgeGroup.add(hiddenLine);

      const visibleLine = new THREE.LineSegments(edgesGeo, visibleEdgeMat);
      visibleLine.renderOrder = 21;
      edgeGroup.add(visibleLine);

      return edgeGroup;
    };

    const createCircleEdgesInXZ = (radius: number, yPos: number, segs = 96) => {
      const pts: THREE.Vector3[] = [];
      const lineDist = new Float32Array(segs * 2);
      const segArcLen = (Math.PI * 2 * radius) / segs;

      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * Math.PI * 2;
        const a2 = ((i + 1) / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(Math.cos(a1) * radius, yPos, Math.sin(a1) * radius),
          new THREE.Vector3(Math.cos(a2) * radius, yPos, Math.sin(a2) * radius)
        );
        lineDist[i * 2] = i * segArcLen;
        lineDist[i * 2 + 1] = (i + 1) * segArcLen;
      }

      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      geo.setAttribute('lineDistance', new THREE.BufferAttribute(lineDist, 1));

      const edgeGroup = new THREE.Group();
      const hiddenLine = new THREE.LineSegments(geo, hiddenEdgeMat);
      hiddenLine.renderOrder = 20;
      edgeGroup.add(hiddenLine);

      const visibleLine = new THREE.LineSegments(geo, visibleEdgeMat);
      visibleLine.renderOrder = 21;
      edgeGroup.add(visibleLine);

      return edgeGroup;
    };

    // Đáy tam giác đều lăng trụ đứng chuẩn SGK Toán 11 (xoay mở góc bao quát thấy rõ cả 2 mặt bên trái & phải, không trùng cạnh)
    const createTriangleShape = () => {
      const shape = new THREE.Shape();
      shape.moveTo(0.26, -0.45);
      shape.lineTo(-0.52, 0.00);
      shape.lineTo(0.26, 0.45);
      shape.closePath();
      return shape;
    };

    const disposeHierarchy = (node: THREE.Object3D) => {
      node.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.LineSegments).isLineSegments) {
          const m = child as THREE.Mesh;
          if (m.geometry) {
            m.geometry.dispose();
          }
          if (m.material) {
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            } else {
              m.material.dispose();
            }
          }
        }
      });
    };

    const buildSpecimen = (id: SpecimenId) => {
      while (specimenMeshGroup.children.length > 0) {
        const child = specimenMeshGroup.children[0];
        disposeHierarchy(child);
        specimenMeshGroup.remove(child);
      }

      const skyBlueMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.65,
        metalness: 0.08,
        depthWrite: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });

      // 4 Khối 3D Chuẩn Sách Giáo Khoa Toán 11 (GDPT 2018)
      if (id === 'cylinder_3d') {
        const cr = 0.46;
        const ch = 1.10;
        const cylGeo = new THREE.CylinderGeometry(cr, cr, ch, 64);
        const mesh = new THREE.Mesh(cylGeo, skyBlueMat);
        mesh.position.set(0, standH + 0.005 + ch / 2, 0);
        mesh.renderOrder = 3;
        mesh.add(createCircleEdgesInXZ(cr, ch / 2, 96));
        mesh.add(createCircleEdgesInXZ(cr, -ch / 2, 96));

        // Hai đường sinh biên thẳng đứng theo góc nhìn xiên chuẩn SGK
        const silLineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0.39, -ch / 2, -0.244),
          new THREE.Vector3(0.39, ch / 2, -0.244),
          new THREE.Vector3(-0.39, -ch / 2, 0.244),
          new THREE.Vector3(-0.39, ch / 2, 0.244),
        ]);
        const silSegments = new THREE.LineSegments(silLineGeo, visibleEdgeMat);
        silSegments.renderOrder = 21;
        mesh.add(silSegments);

        specimenMeshGroup.add(mesh);
      } else if (id === 'pyramid_3d') {
        const halfA = 0.48;
        const pyrH = 1.15;
        const pyrGeo = createPyramidGeometry(halfA, pyrH);
        const mesh = new THREE.Mesh(pyrGeo, skyBlueMat);
        mesh.position.set(0, standH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(pyrGeo, 20)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'cuboid_3d') {
        const rw = 0.90;
        const ch = 1.10;
        const rh = 0.60;
        const boxGeo = new THREE.BoxGeometry(rw, ch, rh);
        const mesh = new THREE.Mesh(boxGeo, skyBlueMat);
        mesh.position.set(0, standH + 0.005 + ch / 2, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(boxGeo)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'prism_3d') {
        const triShape = createTriangleShape();
        const ch = 1.10;
        const prismGeo = new THREE.ExtrudeGeometry(triShape, { depth: ch, bevelEnabled: false });
        const mesh = new THREE.Mesh(prismGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, standH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(prismGeo)));
        specimenMeshGroup.add(mesh);
      }
    };

    buildSpecimen(stateRef.current.specimenId);

    // Chiếu tọa độ mặt sàn sang Canvas 2D
    const mapFloorToCanvas = (Xu: number, Zv: number, out: Point2D) => {
      const u = 0.5 + (Xu - planeSkew * Zv) / planeW;
      const v = 0.5 + Zv / planeD;
      out.x = u * floorCanvas.width;
      out.y = (1 - v) * floorCanvas.height;
    };

    const cosRot = Math.cos(specimenRotY);
    const sinRot = Math.sin(specimenRotY);

    const projectLocalVertexToCanvas = (
      xLoc: number,
      yWorld: number,
      zLoc: number,
      cotAlpha: number,
      out: Point2D
    ) => {
      // Chuẩn Three.js Euler Y rotation: X_world = x*cos + z*sin, Z_world = -x*sin + z*cos
      const wx = xLoc * cosRot + zLoc * sinRot;
      const wz = -xLoc * sinRot + zLoc * cosRot;
      const xuWorld = wx * u_floor.x + wz * u_floor.z;
      const zvWorld = wx * w_depth.x + wz * w_depth.z;
      const xu = xuWorld - (yWorld - floorY) * cotAlpha;
      const zv = zvWorld;
      const u = 0.5 + (xu - planeSkew * zv) / planeW;
      const v = 0.5 + zv / planeD;
      out.x = u * floorCanvas.width;
      out.y = (1 - v) * floorCanvas.height;
    };

    const renderFloorCanvas = (currentLaser: LaserConfig, currentSpecimen: SpecimenId) => {
      const cw = floorCanvas.width;
      const ch = floorCanvas.height;

      floorCtx.fillStyle = '#64748b';
      floorCtx.fillRect(0, 0, cw, ch);

      // Giữ nguyên độ cao tâm chiếu cố định của buồng thí nghiệm khi đổi mẫu vật
      const targetY = FIXED_TARGET_Y;

      const alphaRad = (currentLaser.alpha * Math.PI) / 180;
      const sinAlpha = Math.max(0.01, Math.sin(alphaRad));
      const cotAlpha = Math.cos(alphaRad) / sinAlpha;

      const Xu_spot = -(targetY - floorY) * cotAlpha;
      const Zv_spot = 0;
      const radiusXu = beamRadius / sinAlpha;
      const radiusZv = beamRadius;

      // Đốm sáng trắng tinh khiết trên mặt phẳng (P)
      floorCtx.save();
      const spotAlpha = Math.min(1.0, 0.85 + 0.15 * currentLaser.intensity);
      floorCtx.fillStyle = `rgba(255, 255, 255, ${spotAlpha})`;
      floorCtx.beginPath();
      const spotPts = 64;
      const tempPt: Point2D = { x: 0, y: 0 };
      for (let i = 0; i < spotPts; i++) {
        const phi = (i / spotPts) * Math.PI * 2;
        const xu = Xu_spot + radiusXu * Math.cos(phi);
        const zv = Zv_spot + radiusZv * Math.sin(phi);
        mapFloorToCanvas(xu, zv, tempPt);
        if (i === 0) {
          floorCtx.moveTo(tempPt.x, tempPt.y);
        } else {
          floorCtx.lineTo(tempPt.x, tempPt.y);
        }
      }
      floorCtx.closePath();
      floorCtx.fill();
      floorCtx.restore();

      // Bóng đen tuyền tính toán theo hình chiếu 3D chuẩn xác
      floorCtx.save();
      floorCtx.fillStyle = '#000000';

      const drawHullFromPool = (count: number) => {
        const { hull, size } = computeConvexHullInPlace(_hullPtsPool, count);
        if (size === 0) return;
        floorCtx.beginPath();
        floorCtx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < size; i++) {
          floorCtx.lineTo(hull[i].x, hull[i].y);
        }
        floorCtx.closePath();
        floorCtx.fill();
      };

      // Tại góc chiếu vuông góc 90 độ, bóng nằm hoàn toàn 100% dưới đáy vật thể và bị che khuất tuyệt đối
      // Khi góc chiếu lệch khỏi 90 độ, bóng xuất hiện tự nhiên từ chân đế trải dài theo hướng tia sáng
      if (Math.abs(currentLaser.alpha - 90) >= 0.2) {
        if (currentSpecimen === 'cylinder_3d') {
          const r = 0.46;
          const heightCyl = 1.10;
          const yBot = standH + 0.005;
          const yTop = yBot + heightCyl;
          let pIdx = 0;
          const cylSamples = 32;
          for (let i = 0; i < cylSamples; i++) {
            const phi = (i / cylSamples) * Math.PI * 2;
            const x = r * Math.cos(phi);
            const z = r * Math.sin(phi);
            projectLocalVertexToCanvas(x, yBot, z, cotAlpha, _hullPtsPool[pIdx++]);
            projectLocalVertexToCanvas(x, yTop, z, cotAlpha, _hullPtsPool[pIdx++]);
          }
          drawHullFromPool(pIdx);
        } else if (currentSpecimen === 'pyramid_3d') {
          const halfA = 0.48;
          const heightPyr = 1.15;
          const yBot = standH + 0.005;
          const yTop = yBot + heightPyr;
          let pIdx = 0;
          // 4 đỉnh đáy
          for (const x of [-halfA, halfA]) {
            for (const z of [-halfA, halfA]) {
              projectLocalVertexToCanvas(x, yBot, z, cotAlpha, _hullPtsPool[pIdx++]);
            }
          }
          // Đỉnh chóp S
          projectLocalVertexToCanvas(0, yTop, 0, cotAlpha, _hullPtsPool[pIdx++]);
          drawHullFromPool(pIdx);
        } else if (currentSpecimen === 'cuboid_3d') {
          const rw = 0.90;
          const heightBox = 1.10;
          const rh = 0.60;
          const halfW = rw / 2;
          const halfD = rh / 2;
          const yBot = standH + 0.005;
          const yTop = yBot + heightBox;
          let pIdx = 0;
          for (const x of [-halfW, halfW]) {
            for (const z of [-halfD, halfD]) {
              for (const y of [yBot, yTop]) {
                projectLocalVertexToCanvas(x, y, z, cotAlpha, _hullPtsPool[pIdx++]);
              }
            }
          }
          drawHullFromPool(pIdx);
        } else if (currentSpecimen === 'prism_3d') {
          const heightPrism = 1.10;
          const yBot = standH + 0.005;
          const yTop = yBot + heightPrism;
          const triVerts = [
            { x: 0.26, z: 0.45 },
            { x: -0.52, z: 0.00 },
            { x: 0.26, z: -0.45 },
          ];
          let pIdx = 0;
          for (const v of triVerts) {
            for (const y of [yBot, yTop]) {
              projectLocalVertexToCanvas(v.x, y, v.z, cotAlpha, _hullPtsPool[pIdx++]);
            }
          }
          drawHullFromPool(pIdx);
        }
      }

      floorCtx.restore();
      floorTexture.needsUpdate = true;
    };

    renderFloorCanvas(stateRef.current.laser, stateRef.current.specimenId);

    // Animation Tick Loop với Dirty-Flag Engine
    let animationFrameId: number;
    let isDirty = true;
    let isInitialRenderDone = false;

    const requestRender = () => {
      isDirty = true;
    };

    controls.addEventListener('change', requestRender);

    let lastLaserAlpha = -1;
    let lastLaserIntensity = -1;
    let lastSpecimenId = specimenId;

    stageGroup.visible = true;
    beamSilhouetteGroup.visible = true;

    const camDir = new THREE.Vector3();
    const silVec = new THREE.Vector3();
    const beamDir = new THREE.Vector3();

    let isRunning = true;

    const tick = () => {
      if (!isRunning) return;
      animationFrameId = requestAnimationFrame(tick);
      const currentLaser = stateRef.current.laser;
      const currentSpecimen = stateRef.current.specimenId;

      const specimenChanged = currentSpecimen !== lastSpecimenId;
      const laserChanged = (
        currentLaser.alpha !== lastLaserAlpha ||
        Math.abs(currentLaser.intensity - lastLaserIntensity) > 0.005
      );

      if (specimenChanged || laserChanged) {
        isDirty = true;
      }

      const controlsMoved = controls.update();
      if (controlsMoved) {
        isDirty = true;
      }

      if (isDirty) {
        clampPanToBounds();

        if (specimenChanged) {
          lastSpecimenId = currentSpecimen;
          buildSpecimen(lastSpecimenId);
          renderFloorCanvas(currentLaser, currentSpecimen);
        }

        if (laserChanged) {
          lastLaserAlpha = currentLaser.alpha;
          lastLaserIntensity = currentLaser.intensity;
          renderFloorCanvas(currentLaser, currentSpecimen);
        }

        // Tọa độ đèn Laser trên cung tròn trong mặt phẳng (u_floor, vertical) - Giữ nguyên độ cao đèn cố định
        const targetY = FIXED_TARGET_Y;
        const alphaRad = (currentLaser.alpha * Math.PI) / 180;
        const RL = 4.2;
        const cosAlpha = Math.cos(alphaRad);
        const sinAlpha = Math.max(0.01, Math.sin(alphaRad));

        const lx = RL * cosAlpha * u_floor.x;
        const ly = targetY + RL * sinAlpha;
        const lz = RL * cosAlpha * u_floor.z;

        laserHeadGroup.position.set(lx, ly, lz);

        // Hướng chiếu tia sáng từ đèn tới tâm mẫu vật
        const beamDirX = -cosAlpha * u_floor.x;
        const beamDirY = -sinAlpha;
        const beamDirZ = -cosAlpha * u_floor.z;
        beamDir.set(beamDirX, beamDirY, beamDirZ).normalize();

        // Định hướng đèn laser (Aperture hướng theo beamDir)
        const ey = beamDir.clone().negate();
        const ez = w_depth.clone().negate();
        const ex = new THREE.Vector3().crossVectors(ey, ez).normalize();
        ez.crossVectors(ex, ey).normalize();

        const rotMatrix = new THREE.Matrix4().makeBasis(ex, ey, ez);
        laserHeadGroup.quaternion.setFromRotationMatrix(rotMatrix);

        laserHeadGroup.visible = true;
        beamMesh.visible = true;
        beamSilhouetteGroup.visible = true;

        // Vị trí tâm thấu kính đèn (Aperture Center)
        const halfHousing = housingH / 2;
        const ax = lx + beamDir.x * halfHousing;
        const ay = ly + beamDir.y * halfHousing;
        const az = lz + beamDir.z * halfHousing;

        const posAttr = beamBufferGeo.attributes.position as THREE.BufferAttribute;
        const posArray = posAttr.array as Float32Array;

        for (let i = 0; i <= NUM_SEGMENTS; i++) {
          const phi = (i / NUM_SEGMENTS) * Math.PI * 2;
          const cosP = Math.cos(phi);
          const sinP = Math.sin(phi);

          const px = ax + beamRadius * (cosP * ex.x + sinP * ez.x);
          const py = ay + beamRadius * (cosP * ex.y + sinP * ez.y);
          const pz = az + beamRadius * (cosP * ex.z + sinP * ez.z);

          const topIdx = i * 2 * 3;
          posArray[topIdx] = px;
          posArray[topIdx + 1] = py;
          posArray[topIdx + 2] = pz;

          const botIdx = (i * 2 + 1) * 3;
          const t = (py - floorY) / sinAlpha;
          posArray[botIdx] = px + beamDir.x * t;
          posArray[botIdx + 1] = floorY;
          posArray[botIdx + 2] = pz + beamDir.z * t;
        }

        posAttr.needsUpdate = true;
        beamBufferGeo.computeVertexNormals();

        // Cập nhật Silhouette Boundary Lines
        camera.getWorldDirection(camDir);
        silVec.crossVectors(beamDir, camDir);
        const silLen = silVec.length();

        if (silLen > 0.0001) {
          silVec.divideScalar(silLen);

          const pLeftX = ax + silVec.x * beamRadius;
          const pLeftY = ay + silVec.y * beamRadius;
          const pLeftZ = az + silVec.z * beamRadius;

          const pRightX = ax - silVec.x * beamRadius;
          const pRightY = ay - silVec.y * beamRadius;
          const pRightZ = az - silVec.z * beamRadius;

          const tLeft = (pLeftY - floorY) / sinAlpha;
          const qLeftX = pLeftX + beamDir.x * tLeft;
          const qLeftY = floorY;
          const qLeftZ = pLeftZ + beamDir.z * tLeft;

          const tRight = (pRightY - floorY) / sinAlpha;
          const qRightX = pRightX + beamDir.x * tRight;
          const qRightY = floorY;
          const qRightZ = pRightZ + beamDir.z * tRight;

          silPositions[0] = pLeftX;
          silPositions[1] = pLeftY;
          silPositions[2] = pLeftZ;
          silPositions[3] = qLeftX;
          silPositions[4] = qLeftY;
          silPositions[5] = qLeftZ;

          silPositions[6] = pRightX;
          silPositions[7] = pRightY;
          silPositions[8] = pRightZ;
          silPositions[9] = qRightX;
          silPositions[10] = qRightY;
          silPositions[11] = qRightZ;

          (silGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          beamSilhouetteGroup.visible = true;
        } else {
          beamSilhouetteGroup.visible = false;
        }

        beamMat.opacity = 0.80 * currentLaser.intensity;
        silMat.opacity = Math.min(1.0, 0.75 + 0.25 * currentLaser.intensity);
        silContrastMat.opacity = 0.65 * currentLaser.intensity;

        renderer.render(scene, camera);

        if (!isInitialRenderDone) {
          isInitialRenderDone = true;
          onReady?.();
        }

        if (!controlsMoved) {
          isDirty = false;
        }
      }
    };

    tick();

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      const asp = width / height;
      const fH = Math.max(8.4, 15.2 / asp);
      const hH = fH / 2;
      const hW = hH * asp;
      camera.left = -hW;
      camera.right = hW;
      camera.top = hH;
      camera.bottom = -hH;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      requestRender();
    };

    window.addEventListener('resize', handleResize);

    const updatePixelRatio = () => {
      const pr = isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      if (renderer.getPixelRatio() !== pr) {
        renderer.setPixelRatio(pr);
        handleResize();
      }
    };

    let dprQuery: MediaQueryList | null = null;
    let dprHandler: (() => void) | null = null;

    const listenDPR = () => {
      if (typeof window !== 'undefined' && window.matchMedia) {
        if (dprQuery && dprHandler) {
          dprQuery.removeEventListener('change', dprHandler);
        }
        dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        dprHandler = () => {
          updatePixelRatio();
          listenDPR();
        };
        dprQuery.addEventListener('change', dprHandler, { once: true });
      }
    };
    listenDPR();

    const onContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(animationFrameId);
    };
    const onContextRestored = () => {
      if (!isRunning) return;
      handleResize();
      requestRender();
      cancelAnimationFrame(animationFrameId);
      tick();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      if (dprQuery && dprHandler) {
        dprQuery.removeEventListener('change', dprHandler);
      }
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      disposeHierarchy(scene);
      renderer.dispose();
      pmremGenerator.dispose();
      roomEnvTexture.dispose();
      floorTexture.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full select-none">
      <div ref={containerRef} className="w-full h-full touch-none" />
    </div>
  );
};
