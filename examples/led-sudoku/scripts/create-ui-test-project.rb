require 'xcodeproj'
root=File.expand_path(ARGV[0]);Dir.mkdir(root) unless Dir.exist?(root)
project=Xcodeproj::Project.new(File.join(root,'SudokuUITests.xcodeproj'))
target=project.new_target(:ui_test_bundle,'SudokuUITests',:ios,'15.0')
target.add_file_references([project.main_group.new_file(File.expand_path('test/ios/GenerationUITests.swift'))])
target.build_configurations.each do |config|
 config.build_settings.merge!({'PRODUCT_BUNDLE_IDENTIFIER'=>'org.haiyue.games.ledsudoku.uitests','CODE_SIGN_STYLE'=>'Automatic','GENERATE_INFOPLIST_FILE'=>'YES','SWIFT_VERSION'=>'5.0','TARGETED_DEVICE_FAMILY'=>'1','SUPPORTED_PLATFORMS'=>'iphoneos iphonesimulator'})
end
project.save
scheme=Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path,'SudokuUITests')
