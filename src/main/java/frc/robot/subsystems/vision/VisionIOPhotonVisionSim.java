package frc.robot.subsystems.vision;

import static frc.robot.subsystems.vision.VisionConstants.aprilTagLayout;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Transform3d;
import java.util.function.Supplier;
import org.photonvision.simulation.PhotonCameraSim;
import org.photonvision.simulation.SimCameraProperties;
import org.photonvision.simulation.VisionSystemSim;

/**
 * IO implementation for a simulated PhotonVision camera. Lets you test the whole vision pipeline
 * in "Simulate Robot Code" with no camera or coprocessor.
 */
public class VisionIOPhotonVisionSim extends VisionIOPhotonVision {
  private static VisionSystemSim visionSim;

  private final Supplier<Pose2d> poseSupplier;
  private final PhotonCameraSim cameraSim;

  /**
   * @param name The name of the camera.
   * @param robotToCamera The 3D position of the camera relative to the robot.
   * @param poseSupplier Supplier for the robot pose (from drive odometry) to use in simulation.
   */
  public VisionIOPhotonVisionSim(
      String name, Transform3d robotToCamera, Supplier<Pose2d> poseSupplier) {
    super(name, robotToCamera);
    this.poseSupplier = poseSupplier;

    // One shared simulated field for all cameras
    if (visionSim == null) {
      visionSim = new VisionSystemSim("main");
      visionSim.addAprilTags(aprilTagLayout);
    }

    // Rough camera model, swap in your real camera's resolution/FOV once you know it
    var cameraProperties = new SimCameraProperties();
    cameraProperties.setCalibration(1280, 800, Rotation2d.fromDegrees(70));
    cameraProperties.setCalibError(0.35, 0.10);
    cameraProperties.setFPS(30);
    cameraProperties.setAvgLatencyMs(35);
    cameraProperties.setLatencyStdDevMs(5);

    cameraSim = new PhotonCameraSim(camera, cameraProperties);
    visionSim.addCamera(cameraSim, robotToCamera);
  }

  @Override
  public void updateInputs(VisionIOInputs inputs) {
    visionSim.update(poseSupplier.get());
    super.updateInputs(inputs);
  }
}
