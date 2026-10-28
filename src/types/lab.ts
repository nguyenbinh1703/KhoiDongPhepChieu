/**
 * Định nghĩa kiểu dữ liệu cho mô hình thí nghiệm quang học 3D
 */

export type SpecimenId =
  | 'cylinder_3d'  // Khối trụ
  | 'pyramid_3d'   // Khối chóp tứ giác
  | 'cuboid_3d'    // Khối hộp chữ nhật
  | 'prism_3d';    // Khối lăng trụ tam giác

export interface LaserConfig {
  alpha: number;      // Góc nghiêng chùm tia theo vòng tròn lượng giác (30° đến 150°)
  intensity: number;  // Độ sáng chùm tia (0.20 đến 1.00)
}
