package frc.robot.subsystems.vision;

import edu.wpi.first.apriltag.AprilTagFieldLayout;
import edu.wpi.first.apriltag.AprilTagFields;
import edu.wpi.first.math.geometry.Rotation3d;
import edu.wpi.first.math.geometry.Transform3d;
import edu.wpi.first.math.util.Units;

public class VisionConstants {
  // AprilTag layout for the current season's field
  public static AprilTagFieldLayout aprilTagLayout =
      AprilTagFieldLayout.loadField(AprilTagFields.kDefaultField);

  // Camera names, must match the nicknames set in the PhotonVision web UI
  public static String camera0Name = "camera_0";

  // Robot to camera transform (X forward, Y left, Z up, from robot center on the floor).
  // PLACEHOLDER: measure these on the real robot once the camera is mounted.
  public static Transform3d robotToCamera0 =
      new Transform3d(
          Units.inchesToMeters(10.0),
          Units.inchesToMeters(0.0),
          Units.inchesToMeters(8.0),
          new Rotation3d(0.0, Units.degreesToRadians(-20.0), 0.0));

  // Basic filtering thresholds
  public static double maxAmbiguity = 0.3;
  public static double maxZError = 0.75;

  // Standard deviation baselines, for 1 meter distance and 1 tag
  // (Adjusted automatically based on distance and # of tags)
  public static double linearStdDevBaseline = 0.02; // Meters
  public static double angularStdDevBaseline = 0.06; // Radians

  // Standard deviation multipliers for each camera
  // (Adjust to trust some cameras more than others)
  public static double[] cameraStdDevFactors = new double[] {1.0};
}
